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
		userID, uuid.Nil, // device_id: single-device for now
		peerID, uuid.Nil, // peer_device_id: single-device for now
		key,
	).Scan(&id)
	return id, err
}

// ── Chats ───────────────────────────────────────────────────────────────────

func (r *Repository) CreateChat(ctx context.Context, chatType ChatType, createdBy uuid.UUID, peerIDs []uuid.UUID, status ChatStatus) (uuid.UUID, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	var chatID uuid.UUID
	if err := tx.QueryRow(ctx, `
		INSERT INTO chats (type, created_by, status) VALUES ($1, $2, $3) RETURNING id
	`, string(chatType), createdBy, string(status)).Scan(&chatID); err != nil {
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

func (r *Repository) FindDirectChat(ctx context.Context, userID, peerID uuid.UUID) (*Chat, error) {
	const q = `
		SELECT c.id, c.type, c.title, c.avatar_url, c.created_by, c.status, c.created_at
		FROM chats c
		WHERE c.type = 'direct'
		  AND EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = c.id AND user_id = $1)
		  AND EXISTS (SELECT 1 FROM chat_participants WHERE chat_id = c.id AND user_id = $2)
		LIMIT 1
	`
	var c Chat
	err := r.db.QueryRow(ctx, q, userID, peerID).Scan(&c.ID, &c.Type, &c.Title, &c.AvatarURL, &c.CreatedBy, &c.Status, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) ListChats(ctx context.Context, userID uuid.UUID) ([]Chat, error) {
	const q = `
		SELECT c.id, c.type, c.title, c.avatar_url, c.created_by, c.status, c.created_at
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
		if err := rows.Scan(&c.ID, &c.Type, &c.Title, &c.AvatarURL, &c.CreatedBy, &c.Status, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// PeerUser holds minimal info about a chat's peer for direct chats.
type PeerUser struct {
	ID          uuid.UUID
	DisplayName string
	AvatarURI   string
}

func (r *Repository) PeerUser(ctx context.Context, chatID, userID uuid.UUID) (*PeerUser, error) {
	const q = `
		SELECT u.id, u.display_name, COALESCE(u.avatar_uri, '')
		FROM chat_participants cp
		JOIN users u ON u.id = cp.user_id
		WHERE cp.chat_id = $1 AND cp.user_id <> $2
		LIMIT 1
	`
	var p PeerUser
	if err := r.db.QueryRow(ctx, q, chatID, userID).Scan(&p.ID, &p.DisplayName, &p.AvatarURI); err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) GetChat(ctx context.Context, chatID uuid.UUID) (*Chat, error) {
	const q = `
		SELECT id, type, title, avatar_url, created_by, status, created_at
		FROM chats WHERE id = $1
	`
	var c Chat
	err := r.db.QueryRow(ctx, q, chatID).Scan(
		&c.ID, &c.Type, &c.Title, &c.AvatarURL, &c.CreatedBy, &c.Status, &c.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) IsParticipant(ctx context.Context, chatID, userID uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2
		)
	`, chatID, userID).Scan(&exists)
	return exists, err
}

func (r *Repository) UpdateChatStatus(ctx context.Context, chatID uuid.UUID, status ChatStatus) error {
	_, err := r.db.Exec(ctx, `UPDATE chats SET status = $1 WHERE id = $2`, string(status), chatID)
	return err
}

func (r *Repository) ChatStatus(ctx context.Context, chatID uuid.UUID) (ChatStatus, error) {
	var status ChatStatus
	err := r.db.QueryRow(ctx, `SELECT status FROM chats WHERE id = $1`, chatID).Scan(&status)
	return status, err
}

func (r *Repository) MessageCount(ctx context.Context, chatID, userID uuid.UUID) (int, error) {
	var n int
	err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM messages WHERE chat_id = $1 AND sender_id = $2`, chatID, userID).Scan(&n)
	return n, err
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
// pagination. Content is decrypted on read. Sender display name/avatar are
// joined in the same query to avoid N+1 lookups.
func (r *Repository) ListMessages(ctx context.Context, chatID uuid.UUID, limit int, before int64) ([]Message, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	var rows pgx.Rows
	var err error

	if before > 0 {
		const q = `
			SELECT m.id, m.chat_id, m.sender_id, m.content, m.message_type, m.reply_to_id,
			       m.created_at, m.edited_at, m.deleted_at,
			       COALESCE(u.display_name, ''), COALESCE(u.avatar_uri, '')
			FROM messages m
			LEFT JOIN users u ON u.id = m.sender_id
			WHERE m.chat_id = $1 AND m.id < $2 AND m.deleted_at IS NULL
			ORDER BY m.id DESC
			LIMIT $3
		`
		rows, err = r.db.Query(ctx, q, chatID, before, limit)
	} else {
		const q = `
			SELECT m.id, m.chat_id, m.sender_id, m.content, m.message_type, m.reply_to_id,
			       m.created_at, m.edited_at, m.deleted_at,
			       COALESCE(u.display_name, ''), COALESCE(u.avatar_uri, '')
			FROM messages m
			LEFT JOIN users u ON u.id = m.sender_id
			WHERE m.chat_id = $1 AND m.deleted_at IS NULL
			ORDER BY m.id DESC
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
		var senderName, senderAvatar string
		if err := rows.Scan(&m.ID, &m.ChatID, &m.SenderID, &m.Content,
			&m.MessageType, &m.ReplyToID, &m.CreatedAt, &m.EditedAt, &m.DeletedAt,
			&senderName, &senderAvatar); err != nil {
			return nil, err
		}
		out = append(out, Message{
			ID:           m.ID,
			ChatID:       m.ChatID,
			SenderID:     m.SenderID,
			Content:      r.decrypt(m.Content),
			MessageType:  MessageType(m.MessageType),
			ReplyToID:    m.ReplyToID,
			CreatedAt:    m.CreatedAt,
			EditedAt:     m.EditedAt,
			DeletedAt:    m.DeletedAt,
			SenderName:   senderName,
			SenderAvatar: senderAvatar,
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
