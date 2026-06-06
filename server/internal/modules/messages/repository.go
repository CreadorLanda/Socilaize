package messages

import (
	"context"
	"encoding/hex"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/CreadorLanda/Socilaize/server/internal/crypto"
)

type Repository struct {
	db     *pgxpool.Pool
	msgKey []byte // AES-256 key; nil = plaintext fallback
	keyOK  bool
}

func NewRepository(db *pgxpool.Pool, msgKeyHex string) *Repository {
	r := &Repository{db: db}
	if msgKeyHex != "" {
		key, err := hex.DecodeString(msgKeyHex)
		if err == nil && len(key) == 32 {
			r.msgKey = key
			r.keyOK = true
		}
	}
	return r
}

func (r *Repository) encrypt(plaintext string) string {
	if !r.keyOK || plaintext == "" {
		return plaintext
	}
	enc, err := crypto.Encrypt(plaintext, r.msgKey)
	if err != nil {
		return plaintext
	}
	return enc
}

func (r *Repository) decrypt(stored string) string {
	if !r.keyOK || stored == "" {
		return stored
	}
	dec, err := crypto.Decrypt(stored, r.msgKey)
	if err != nil {
		return stored
	}
	return dec
}

// ── Sessions ────────────────────────────────────────────────────────────────

func (r *Repository) GetSession(ctx context.Context, userID, peerID uuid.UUID) (*sessionRow, error) {
	const q = `
		SELECT id, user_id, peer_id, session_key, created_at
		FROM sessions
		WHERE user_id = $1 AND peer_id = $2
		ORDER BY created_at DESC
		LIMIT 1
	`
	row := r.db.QueryRow(ctx, q, userID, peerID)
	var s sessionRow
	if err := row.Scan(&s.ID, &s.UserID, &s.PeerID, &s.SessionKey, &s.CreatedAt); err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) UpsertSession(ctx context.Context, userID, peerID uuid.UUID, key []byte) (uuid.UUID, error) {
	const q = `
		INSERT INTO sessions (user_id, device_id, peer_id, peer_device_id, session_key)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, device_id, peer_id, peer_device_id)
		DO UPDATE SET session_key = EXCLUDED.session_key, created_at = NOW()
		RETURNING id
	`
	var id uuid.UUID
	err := r.db.QueryRow(ctx, q,
		userID, uuid.Nil,    // device_id: single-device for now
		peerID, uuid.Nil,    // peer_device_id: single-device for now
		key,
	).Scan(&id)
	return id, err
}

// ── Chats ───────────────────────────────────────────────────────────────────

func (r *Repository) CreateChat(ctx context.Context, chatType ChatType, createdBy uuid.UUID, peerIDs []uuid.UUID) (uuid.UUID, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	var chatID uuid.UUID
	if err := tx.QueryRow(ctx, `
		INSERT INTO chats (type, created_by) VALUES ($1, $2) RETURNING id
	`, string(chatType), createdBy).Scan(&chatID); err != nil {
		return uuid.Nil, err
	}

	for _, pid := range peerIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING
		`, chatID, pid); err != nil {
			return uuid.Nil, err
		}
	}

	return chatID, tx.Commit(ctx)
}

func (r *Repository) FindDirectChat(ctx context.Context, userID, peerID uuid.UUID) (*uuid.UUID, error) {
	const q = `
		SELECT c.id FROM chats c
		WHERE c.type = 'direct'
		  AND EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = c.id AND user_id = $1)
		  AND EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = c.id AND user_id = $2)
		LIMIT 1
	`
	var id uuid.UUID
	err := r.db.QueryRow(ctx, q, userID, peerID).Scan(&id)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func (r *Repository) ListChats(ctx context.Context, userID uuid.UUID) ([]Chat, error) {
	const q = `
		SELECT c.id, c.type, c.title, c.avatar_url, c.created_by, c.created_at
		FROM chats c
		JOIN chat_participants cp ON cp.chat_id = c.id
		WHERE cp.user_id = $1
		ORDER BY c.created_at DESC
	`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Chat
	for rows.Next() {
		var c Chat
		if err := rows.Scan(&c.ID, &c.Type, &c.Title, &c.AvatarURL, &c.CreatedBy, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// ── Messages ────────────────────────────────────────────────────────────────

// InsertMessage stores a message with encrypted content. Returns the new ID.
func (r *Repository) InsertMessage(ctx context.Context, chatID, senderID uuid.UUID, content string, msgType MessageType, replyToID *int64) (int64, error) {
	const q = `
		INSERT INTO messages (chat_id, sender_id, content, message_type, reply_to_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	encrypted := r.encrypt(content)
	var id int64
	err := r.db.QueryRow(ctx, q, chatID, senderID, encrypted, string(msgType), replyToID).Scan(&id)
	return id, err
}

// ListMessages returns messages for a chat, newest first, with cursor-based
// pagination. Content is decrypted on read.
func (r *Repository) ListMessages(ctx context.Context, chatID uuid.UUID, limit int, before int64) ([]Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var rows pgx.Rows
	var err error

	if before > 0 {
		const q = `
			SELECT id, chat_id, sender_id, content, message_type, reply_to_id,
			       created_at, edited_at, deleted_at
			FROM messages
			WHERE chat_id = $1 AND id < $2 AND deleted_at IS NULL
			ORDER BY id DESC
			LIMIT $3
		`
		rows, err = r.db.Query(ctx, q, chatID, before, limit)
	} else {
		const q = `
			SELECT id, chat_id, sender_id, content, message_type, reply_to_id,
			       created_at, edited_at, deleted_at
			FROM messages
			WHERE chat_id = $1 AND deleted_at IS NULL
			ORDER BY id DESC
			LIMIT $2
		`
		rows, err = r.db.Query(ctx, q, chatID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Message
	for rows.Next() {
		var m messageRow
		if err := rows.Scan(&m.ID, &m.ChatID, &m.SenderID, &m.Content,
			&m.MessageType, &m.ReplyToID, &m.CreatedAt, &m.EditedAt, &m.DeletedAt); err != nil {
			return nil, err
		}
		out = append(out, Message{
			ID:          m.ID,
			ChatID:      m.ChatID,
			SenderID:    m.SenderID,
			Content:     r.decrypt(m.Content),
			MessageType: MessageType(m.MessageType),
			ReplyToID:   m.ReplyToID,
			CreatedAt:   m.CreatedAt,
			EditedAt:    m.EditedAt,
			DeletedAt:   m.DeletedAt,
		})
	}
	return out, rows.Err()
}

// LastMessagePlain returns the most-recent non-deleted message with
// decrypted content for chat list previews.
func (r *Repository) LastMessage(ctx context.Context, chatID uuid.UUID) (*MessagePreview, error) {
	const q = `
		SELECT content, sender_id, created_at
		FROM messages
		WHERE chat_id = $1 AND deleted_at IS NULL
		ORDER BY id DESC
		LIMIT 1
	`
	var preview MessagePreview
	var ciphertext string
	if err := r.db.QueryRow(ctx, q, chatID).Scan(&ciphertext, &preview.SenderID, &preview.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	preview.Content = r.decrypt(ciphertext)
	return &preview, nil
}
