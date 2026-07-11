// Package messages implements native E2E-encrypted messaging for Socialize.
//
// Message content is encrypted with AES-256-GCM at rest using a session
// key derived via X3DH between sender and recipient. The X3DH pre-key
// infrastructure lives in internal/modules/keys.
package messages

import (
	"time"

	"github.com/google/uuid"
)

// ── Chat ────────────────────────────────────────────────────────────────────

type ChatType string

const (
	ChatDirect ChatType = "direct"
	ChatGroup  ChatType = "group"
)

type ChatStatus string

const (
	ChatStatusActive  ChatStatus = "active"
	ChatStatusPending ChatStatus = "pending"
	ChatStatusBlocked ChatStatus = "blocked"
)

type Chat struct {
	ID          uuid.UUID       `json:"id"`
	Type        ChatType        `json:"type"`
	Title       *string         `json:"title,omitempty"`
	AvatarURL   *string         `json:"avatar_url,omitempty"`
	CreatedBy   uuid.UUID       `json:"created_by"`
	Status      ChatStatus      `json:"status"`
	CreatedAt   time.Time       `json:"created_at"`
	LastMessage *MessagePreview `json:"last_message,omitempty"`
	UnreadCount int             `json:"unread_count"`
}

type MessagePreview struct {
	Content   string    `json:"content"`
	SenderID  uuid.UUID `json:"sender_id"`
	CreatedAt time.Time `json:"created_at"`
}

// ── Message ─────────────────────────────────────────────────────────────────

type MessageType string

const (
	MsgText     MessageType = "text"
	MsgImage    MessageType = "image"
	MsgVideo    MessageType = "video"
	MsgAudio    MessageType = "audio"
	MsgDocument MessageType = "document"
	MsgSticker  MessageType = "sticker"
	MsgLocation MessageType = "location"
	MsgContact  MessageType = "contact"
	MsgPoll     MessageType = "poll"
	MsgEvent    MessageType = "event"
	MsgSystem   MessageType = "system"
	MsgReply    MessageType = "reply"
)

type Message struct {
	ID           int64       `json:"id"`
	ChatID       uuid.UUID   `json:"chat_id"`
	SenderID     uuid.UUID   `json:"sender_id"`
	Content      string      `json:"content"` // plaintext (client input / decrypted output)
	MessageType  MessageType `json:"message_type"`
	ReplyToID    *int64      `json:"reply_to_id,omitempty"`
	CreatedAt    time.Time   `json:"created_at"`
	EditedAt     *time.Time  `json:"edited_at,omitempty"`
	DeletedAt    *time.Time  `json:"deleted_at,omitempty"`
	SenderName   string      `json:"sender_name,omitempty"`
	SenderAvatar string      `json:"sender_avatar,omitempty"`
}

// ── Session ─────────────────────────────────────────────────────────────────

// SessionInitRequest starts an E2EE session with a peer. The client
// provides the peer's username; the server fetches their pre-key bundle,
// performs X3DH, and stores a derived AES-256 key.
type SessionInitRequest struct {
	PeerUsername string `json:"peer_username" binding:"required"`
	DeviceID     string `json:"device_id" binding:"required"`
}

// SessionInitResponse tells the client whether the session was newly
// created or already existed.
type SessionInitResponse struct {
	SessionID uuid.UUID `json:"session_id"`
	Created   bool      `json:"created"`
}

// ── Requests / Responses ────────────────────────────────────────────────────

type CreateChatRequest struct {
	// For direct chats, the peer's user ID (resolved from username server-side).
	PeerUserID uuid.UUID `json:"peer_user_id" binding:"required"`
}

type CreateChatResponse struct {
	ChatID uuid.UUID `json:"chat_id"`
	Chat   Chat      `json:"chat"`
}

type SendMessageRequest struct {
	Content     string      `json:"content" binding:"required"`
	MessageType MessageType `json:"message_type"`
	ReplyToID   *int64      `json:"reply_to_id,omitempty"`
}

type ListMessagesQuery struct {
	Limit  int `form:"limit"`
	Before int `form:"before"` // cursor: message ID to fetch older than
}

// ── Internal row shapes ─────────────────────────────────────────────────────

type messageRow struct {
	ID          int64
	ChatID      uuid.UUID
	SenderID    uuid.UUID
	Content     string // ciphertext hex
	MessageType string
	ReplyToID   *int64
	CreatedAt   time.Time
	EditedAt    *time.Time
	DeletedAt   *time.Time
}

type sessionRow struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	PeerID     uuid.UUID
	SessionKey []byte // 32-byte AES-256 key
	CreatedAt  time.Time
}
