package messages

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/CreadorLanda/Socilaize/server/internal/modules/keys"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/users"
)

var (
	ErrChatNotFound    = errors.New("chat_not_found")
	ErrNoSession       = errors.New("no_e2ee_session")
	ErrNotParticipant  = errors.New("not_participant")
)

type Service struct {
	repo    *Repository
	keysSvc *keys.Service
	users   *users.Repository
}

func NewService(repo *Repository, keysSvc *keys.Service, usersRepo *users.Repository) *Service {
	return &Service{repo: repo, keysSvc: keysSvc, users: usersRepo}
}

// ── Session Init ────────────────────────────────────────────────────────────

// InitSession establishes an E2EE session. It fetches the peer's pre-key
// bundle, extracts identity keys, and derives a shared AES-256 key using
// HMAC-HKDF over both identity keys plus a server-generated nonce.
//
// In a full client-side X3DH implementation the DH computation happens on
// the device. Here we derive the key server-side for practical at-rest
// encryption; the key never leaves the database.
func (s *Service) InitSession(ctx context.Context, userID uuid.UUID, peerUsername string) (SessionInitResponse, error) {
	peerUser, err := s.users.ByUsername(ctx, peerUsername)
	if err != nil {
		if users.IsNoRows(err) {
			return SessionInitResponse{}, users.ErrNotFound
		}
		return SessionInitResponse{}, fmt.Errorf("resolve peer: %w", err)
	}

	existing, err := s.repo.GetSession(ctx, userID, peerUser.ID)
	if err == nil && existing != nil {
		return SessionInitResponse{SessionID: existing.ID, Created: false}, nil
	}

	bundle, err := s.keysSvc.BundleByUsername(ctx, peerUsername)
	if err != nil {
		return SessionInitResponse{}, fmt.Errorf("fetch peer bundle: %w", err)
	}

	// Decode the peer's identity key.
	peerIdentity, err := base64.RawURLEncoding.DecodeString(bundle.IdentityKey)
	if err != nil {
		return SessionInitResponse{}, fmt.Errorf("decode peer identity: %w", err)
	}

	// Derive session key: HKDF( peer_identity || random_32_bytes, salt, 32 )
	nonce := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return SessionInitResponse{}, fmt.Errorf("nonce: %w", err)
	}

	salt := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return SessionInitResponse{}, fmt.Errorf("salt: %w", err)
	}

	ikm := append(peerIdentity, nonce...)
	sessionKey := hkdfDerive(ikm, salt, 32)

	sessionID, err := s.repo.UpsertSession(ctx, userID, peerUser.ID, sessionKey)
	if err != nil {
		return SessionInitResponse{}, fmt.Errorf("store session: %w", err)
	}

	return SessionInitResponse{SessionID: sessionID, Created: true}, nil
}

// ── Chats ───────────────────────────────────────────────────────────────────

func (s *Service) CreateDirectChat(ctx context.Context, userID, peerID uuid.UUID) (Chat, error) {
	existing, err := s.repo.FindDirectChat(ctx, userID, peerID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Chat{}, err
	}
	if existing != nil {
		return s.loadChat(ctx, *existing, userID)
	}

	chatID, err := s.repo.CreateChat(ctx, ChatDirect, userID, []uuid.UUID{userID, peerID})
	if err != nil {
		return Chat{}, err
	}
	return s.loadChat(ctx, chatID, userID)
}

func (s *Service) ListChats(ctx context.Context, userID uuid.UUID) ([]Chat, error) {
	chats, err := s.repo.ListChats(ctx, userID)
	if err != nil {
		return nil, err
	}
	// Enrich each chat with the last message.
	for i, c := range chats {
		preview, err := s.repo.LastMessage(ctx, c.ID)
		if err == nil && preview != nil {
			chats[i].LastMessage = preview
		}
	}
	return chats, nil
}

// ── Messages ────────────────────────────────────────────────────────────────

func (s *Service) SendMessage(ctx context.Context, chatID, senderID uuid.UUID, req SendMessageRequest) (Message, error) {
	msgType := req.MessageType
	if msgType == "" {
		msgType = MsgText
	}
	id, err := s.repo.InsertMessage(ctx, chatID, senderID, req.Content, msgType, req.ReplyToID)
	if err != nil {
		return Message{}, err
	}
	return s.getMessage(ctx, chatID, id)
}

func (s *Service) ListMessages(ctx context.Context, chatID uuid.UUID, limit int, before int64) ([]Message, error) {
	return s.repo.ListMessages(ctx, chatID, limit, before)
}

// ── Internal helpers ────────────────────────────────────────────────────────

func (s *Service) loadChat(ctx context.Context, chatID uuid.UUID, forUser uuid.UUID) (Chat, error) {
	chats, err := s.repo.ListChats(ctx, forUser)
	if err != nil {
		return Chat{}, err
	}
	for _, c := range chats {
		if c.ID == chatID {
			preview, _ := s.repo.LastMessage(ctx, chatID)
			c.LastMessage = preview
			return c, nil
		}
	}
	return Chat{}, ErrChatNotFound
}

func (s *Service) getMessage(ctx context.Context, chatID uuid.UUID, msgID int64) (Message, error) {
	msgs, err := s.repo.ListMessages(ctx, chatID, 1, msgID+1)
	if err != nil {
		return Message{}, err
	}
	for _, m := range msgs {
		if m.ID == msgID {
			return m, nil
		}
	}
	return Message{}, ErrChatNotFound
}

// ── HKDF ────────────────────────────────────────────────────────────────────

// hkdfDerive derives key material using HMAC-based HKDF (RFC 5869
// simplified: extract-then-expand with a single info step).
func hkdfDerive(ikm, salt []byte, outLen int) []byte {
	if len(salt) == 0 {
		salt = make([]byte, 32)
	}

	// Extract
	prk := hmac.New(sha256.New, salt)
	prk.Write(ikm)
	pseudoRandKey := prk.Sum(nil)

	// Expand (single block for up to 32 bytes)
	exp := hmac.New(sha256.New, pseudoRandKey)
	exp.Write([]byte{0x01})
	out := exp.Sum(nil)

	if len(out) > outLen {
		out = out[:outLen]
	}
	return out
}
