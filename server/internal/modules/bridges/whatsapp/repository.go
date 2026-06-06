package whatsapp

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/CreadorLanda/Socilaize/server/internal/crypto"
)

type Repository struct {
	db       *pgxpool.Pool
	msgKey   []byte // AES-256 key for content encryption; nil = plaintext
	msgKeyOK bool   // true when msgKey is valid and encryption is active
}

// NewRepository creates the repository. If msgKeyHex is non-empty it must
// be a hex-encoded 32-byte AES-256 key; messages will be encrypted at rest.
// Pass "" to store in plaintext (dev fallback).
func NewRepository(db *pgxpool.Pool, msgKeyHex string) *Repository {
	r := &Repository{db: db}
	if msgKeyHex != "" {
		key, err := hex.DecodeString(msgKeyHex)
		if err == nil && len(key) == 32 {
			r.msgKey = key
			r.msgKeyOK = true
		}
		// If the hex is invalid we silently fall back to plaintext — the
		// config loader is the place to surface the error.
	}
	return r
}

// encryptContent encrypts plaintext with the message key. If encryption is
// not configured (no key), returns the original plaintext unchanged.
func (r *Repository) encryptContent(plaintext string) string {
	if !r.msgKeyOK || plaintext == "" {
		return plaintext
	}
	enc, err := crypto.Encrypt(plaintext, r.msgKey)
	if err != nil {
		return plaintext // best-effort; caller sees plaintext, not a crash
	}
	return enc
}

// decryptContent reverses encryptContent. If no key is configured, returns
// the stored text as-is (plaintext fallback).
func (r *Repository) decryptContent(stored string) string {
	if !r.msgKeyOK || stored == "" {
		return stored
	}
	dec, err := crypto.Decrypt(stored, r.msgKey)
	if err != nil {
		return stored // best-effort; if the key changed between write and
		// read we return ciphertext (user sees garbage, not a crash)
	}
	return dec
}

// UpsertPending records the start of a link attempt: phone + pairing code +
// expiry. If a row already exists for the user we overwrite — the user is
// asking to re-pair, and the old code is no longer useful anyway.
func (r *Repository) UpsertPending(ctx context.Context, userID uuid.UUID, phone, code string, expiresAt time.Time) error {
	const q = `
		INSERT INTO wa_bridges (user_id, phone, status, pairing_code, pairing_expires_at, updated_at)
		VALUES ($1, $2, 'pending', $3, $4, NOW())
		ON CONFLICT (user_id) DO UPDATE
		   SET phone              = EXCLUDED.phone,
		       status             = 'pending',
		       pairing_code       = EXCLUDED.pairing_code,
		       pairing_expires_at = EXCLUDED.pairing_expires_at,
		       jid                = NULL,
		       last_error         = NULL,
		       linked_at          = NULL,
		       updated_at         = NOW()
	`
	_, err := r.db.Exec(ctx, q, userID, phone, code, expiresAt)
	return err
}

// MarkLinked is called from the pair_success event handler — clears the
// pairing code and stamps linked_at.
func (r *Repository) MarkLinked(ctx context.Context, userID uuid.UUID, jid string) error {
	const q = `
		UPDATE wa_bridges
		SET status             = 'linked',
		    jid                = $2,
		    pairing_code       = NULL,
		    pairing_expires_at = NULL,
		    last_error         = NULL,
		    linked_at          = NOW(),
		    updated_at         = NOW()
		WHERE user_id = $1
	`
	ct, err := r.db.Exec(ctx, q, userID, jid)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("no wa_bridge row for user %s", userID)
	}
	return nil
}

// MarkFailed surfaces an error to /status without dropping the row.
func (r *Repository) MarkFailed(ctx context.Context, userID uuid.UUID, reason string) error {
	const q = `
		UPDATE wa_bridges
		SET status     = 'failed',
		    last_error = $2,
		    updated_at = NOW()
		WHERE user_id = $1
	`
	_, err := r.db.Exec(ctx, q, userID, reason)
	return err
}

// MarkDisconnected — explicit unlink or remote logout.
func (r *Repository) MarkDisconnected(ctx context.Context, userID uuid.UUID) error {
	const q = `
		UPDATE wa_bridges
		SET status     = 'disconnected',
		    updated_at = NOW()
		WHERE user_id = $1
	`
	_, err := r.db.Exec(ctx, q, userID)
	return err
}

// Get fetches the user's bridge row, or pgx.ErrNoRows if there's none.
func (r *Repository) Get(ctx context.Context, userID uuid.UUID) (*bridgeRow, error) {
	const q = `
		SELECT phone, jid, status, pairing_code, pairing_expires_at, last_error, linked_at, updated_at
		FROM wa_bridges
		WHERE user_id = $1
	`
	row := r.db.QueryRow(ctx, q, userID)
	var b bridgeRow
	if err := row.Scan(&b.Phone, &b.JID, &b.Status, &b.PairingCode, &b.PairingExpiresAt, &b.LastError, &b.LinkedAt, &b.UpdatedAt); err != nil {
		return nil, err
	}
	return &b, nil
}

// UpsertFailed records a failed pairing attempt for the cooldown logic.
func (r *Repository) UpsertFailed(ctx context.Context, userID uuid.UUID, phone, reason string) error {
	const q = `
		INSERT INTO wa_bridges (user_id, phone, status, last_error, updated_at)
		VALUES ($1, $2, 'failed', $3, NOW())
		ON CONFLICT (user_id) DO UPDATE
		   SET phone              = EXCLUDED.phone,
		       status             = 'failed',
		       last_error         = EXCLUDED.last_error,
		       pairing_code       = NULL,
		       pairing_expires_at = NULL,
		       updated_at         = NOW()
	`
	_, err := r.db.Exec(ctx, q, userID, phone, reason)
	return err
}

// Delete removes the bridge row entirely.
func (r *Repository) Delete(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM wa_bridges WHERE user_id = $1`, userID)
	return err
}

// ── Incoming messages ───────────────────────────────────────────────────────

// IncomingMessage is the shape the webhook handler sends us after decoding
// the sidecar's payload. Fields are already sanitised by the handler.
type IncomingMessage struct {
	WaMessageID string
	ChatJID     string
	SenderJID   string
	Content     string
	MediaURL    string
	MessageType string
	WaTimestamp int64
}

// StoredMessage is the read-side shape with decrypted content.
type StoredMessage struct {
	ID          int64     `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	WaMessageID string    `json:"wa_message_id"`
	ChatJID     string    `json:"chat_jid"`
	SenderJID   string    `json:"sender_jid"`
	MessageType string    `json:"message_type"`
	Content     string    `json:"content"`
	MediaURL    string    `json:"media_url,omitempty"`
	WaTimestamp int64     `json:"wa_timestamp"`
	CreatedAt   time.Time `json:"created_at"`
}

// maxContentLen matches the DB constraint (65536 chars).
const maxContentLen = 65536

// InsertMessage persists an incoming WhatsApp message. Content is encrypted
// at rest when a message key is configured.
func (r *Repository) InsertMessage(ctx context.Context, userID uuid.UUID, msg IncomingMessage) error {
	const q = `
		INSERT INTO wa_messages
			(user_id, wa_message_id, chat_jid, sender_jid, message_type, content, media_url, wa_timestamp)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (wa_message_id) DO NOTHING
	`
	content := msg.Content
	if len(content) > maxContentLen {
		content = content[:maxContentLen]
	}
	content = r.encryptContent(content)

	_, err := r.db.Exec(ctx, q,
		userID,
		msg.WaMessageID,
		msg.ChatJID,
		msg.SenderJID,
		msg.MessageType,
		content,
		msg.MediaURL,
		msg.WaTimestamp,
	)
	return err
}

// ListMessages returns the most recent messages for a user's chat.
// Content is decrypted on read.
func (r *Repository) ListMessages(ctx context.Context, userID uuid.UUID, chatJID string, limit int) ([]StoredMessage, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	const q = `
		SELECT id, user_id, wa_message_id, chat_jid, sender_jid,
		       message_type, content, media_url, wa_timestamp, created_at
		FROM wa_messages
		WHERE user_id = $1 AND chat_jid = $2
		ORDER BY wa_timestamp DESC
		LIMIT $3
	`
	rows, err := r.db.Query(ctx, q, userID, chatJID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []StoredMessage
	for rows.Next() {
		var m StoredMessage
		if err := rows.Scan(&m.ID, &m.UserID, &m.WaMessageID, &m.ChatJID,
			&m.SenderJID, &m.MessageType, &m.Content, &m.MediaURL,
			&m.WaTimestamp, &m.CreatedAt); err != nil {
			return nil, err
		}
		m.Content = r.decryptContent(m.Content)
		out = append(out, m)
	}
	return out, rows.Err()
}

// IsNoRows keeps pgx out of caller imports.
func IsNoRows(err error) bool { return err != nil && errors.Is(err, pgx.ErrNoRows) }
