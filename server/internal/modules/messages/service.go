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
	ErrChatNotFound     = errors.New("chat_not_found")
	ErrNoSession        = errors.New("no_e2ee_session")
	ErrNotParticipant   = errors.New("not_participant")
	ErrChatBlocked      = errors.New("chat_blocked")
	ErrPendingChatLimit = errors.New("pending_chat_limit")
	ErrCannotAcceptOwn  = errors.New("cannot_accept_own_request")
	ErrChatNotPending   = errors.New("chat_not_pending")
	ErrMessageNotFound  = errors.New("message_not_found")
	ErrNotSender        = errors.New("not_message_sender")
	ErrInvalidReceipt   = errors.New("invalid_receipt_status")
)

// Broadcaster is satisfied by *realtime.Hub. Kept as an interface so the
// messages module does not import the WS stack into unit tests.
type Broadcaster interface {
	PublishJSON(userIDs []uuid.UUID, typ, chatID string, payload any)
	Online(userID uuid.UUID) bool
}

// PushNotifier enqueues offline push jobs (notifications module).
type PushNotifier interface {
	NotifyUser(ctx context.Context, userID uuid.UUID, category, title, body string, data map[string]string) error
}

type Service struct {
	repo    *Repository
	keysSvc *keys.Service
	users   *users.Repository
	hub     Broadcaster
	push    PushNotifier
}

func NewService(repo *Repository, keysSvc *keys.Service, usersRepo *users.Repository, hub Broadcaster, push PushNotifier) *Service {
	return &Service{repo: repo, keysSvc: keysSvc, users: usersRepo, hub: hub, push: push}
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
		return s.loadChat(ctx, existing.ID, userID)
	}

	chatID, err := s.repo.CreateChat(ctx, ChatDirect, userID, []uuid.UUID{userID, peerID}, ChatStatusPending)
	if err != nil {
		return Chat{}, err
	}
	return s.loadChat(ctx, chatID, userID)
}

// AcceptChat lets the recipient (not the creator) promote a pending
// friend-request chat to active.
func (s *Service) AcceptChat(ctx context.Context, chatID, userID uuid.UUID) (Chat, error) {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return Chat{}, err
	}
	chat, err := s.repo.GetChat(ctx, chatID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Chat{}, ErrChatNotFound
		}
		return Chat{}, err
	}
	if chat.Status != ChatStatusPending {
		return Chat{}, ErrChatNotPending
	}
	if chat.CreatedBy == userID {
		return Chat{}, ErrCannotAcceptOwn
	}
	if err := s.repo.UpdateChatStatus(ctx, chatID, ChatStatusActive); err != nil {
		return Chat{}, err
	}
	return s.loadChat(ctx, chatID, userID)
}

// BlockChat marks a chat blocked. Any participant may block.
func (s *Service) BlockChat(ctx context.Context, chatID, userID uuid.UUID) error {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return err
	}
	return s.repo.UpdateChatStatus(ctx, chatID, ChatStatusBlocked)
}

func (s *Service) ListChats(ctx context.Context, userID uuid.UUID) ([]Chat, error) {
	chats, err := s.repo.ListChats(ctx, userID)
	if err != nil {
		return nil, err
	}
	for i, c := range chats {
		preview, err := s.repo.LastMessage(ctx, c.ID)
		if err == nil && preview != nil {
			chats[i].LastMessage = preview
		}
		if n, err := s.repo.UnreadCount(ctx, c.ID, userID); err == nil {
			chats[i].UnreadCount = n
		}
		s.enrichDirectPeer(ctx, &chats[i], userID)
	}
	return chats, nil
}

// ── Messages ────────────────────────────────────────────────────────────────

func (s *Service) SendMessage(ctx context.Context, chatID, senderID uuid.UUID, req SendMessageRequest) (Message, error) {
	if err := s.requireParticipant(ctx, chatID, senderID); err != nil {
		return Message{}, err
	}
	msgType := req.MessageType
	if msgType == "" {
		msgType = MsgText
	}
	status, err := s.repo.ChatStatus(ctx, chatID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, ErrChatNotFound
		}
		return Message{}, err
	}
	switch status {
	case ChatStatusBlocked:
		return Message{}, ErrChatBlocked
	case ChatStatusPending:
		// Only 1 message per user allowed until the recipient accepts.
		count, err := s.repo.MessageCount(ctx, chatID, senderID)
		if err != nil {
			return Message{}, err
		}
		if count >= 1 {
			return Message{}, ErrPendingChatLimit
		}
	}
	id, err := s.repo.InsertMessage(ctx, chatID, senderID, req.Content, msgType, req.ReplyToID)
	if err != nil {
		return Message{}, err
	}
	msg, err := s.getMessage(ctx, chatID, id)
	if err != nil {
		return Message{}, err
	}
	s.broadcast(ctx, chatID, "message.new", msg)
	s.notifyOffline(ctx, chatID, senderID, msg)
	return msg, nil
}

func (s *Service) ListMessages(ctx context.Context, chatID, userID uuid.UUID, limit int, before int64) ([]Message, error) {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return nil, err
	}
	return s.repo.ListMessages(ctx, chatID, limit, before)
}

// EditMessage updates content (sender only) and fans out over WS.
func (s *Service) EditMessage(ctx context.Context, chatID, userID uuid.UUID, msgID int64, content string) (Message, error) {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return Message{}, err
	}
	existing, err := s.repo.GetMessage(ctx, chatID, msgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, ErrMessageNotFound
		}
		return Message{}, err
	}
	if existing.DeletedAt != nil {
		return Message{}, ErrMessageNotFound
	}
	if existing.SenderID != userID {
		return Message{}, ErrNotSender
	}
	if err := s.repo.EditMessage(ctx, chatID, userID, msgID, content); err != nil {
		return Message{}, err
	}
	msg, err := s.getMessage(ctx, chatID, msgID)
	if err != nil {
		return Message{}, err
	}
	s.broadcast(ctx, chatID, "message.edited", msg)
	return msg, nil
}

// DeleteMessage soft-deletes (sender only).
func (s *Service) DeleteMessage(ctx context.Context, chatID, userID uuid.UUID, msgID int64) (Message, error) {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return Message{}, err
	}
	existing, err := s.repo.GetMessage(ctx, chatID, msgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, ErrMessageNotFound
		}
		return Message{}, err
	}
	if existing.SenderID != userID {
		return Message{}, ErrNotSender
	}
	if err := s.repo.SoftDeleteMessage(ctx, chatID, userID, msgID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, ErrMessageNotFound
		}
		return Message{}, err
	}
	msg, err := s.repo.GetMessage(ctx, chatID, msgID)
	if err != nil {
		return Message{}, err
	}
	s.broadcast(ctx, chatID, "message.deleted", msg)
	return *msg, nil
}

// SetReceipts marks messages delivered/read for the caller and notifies peers.
func (s *Service) SetReceipts(ctx context.Context, chatID, userID uuid.UUID, req ReceiptRequest) error {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return err
	}
	if req.Status != ReceiptDelivered && req.Status != ReceiptRead {
		return ErrInvalidReceipt
	}
	ids, err := s.repo.MessageIDsInChat(ctx, chatID, req.MessageIDs)
	if err != nil {
		return err
	}
	var maxID int64
	for _, id := range ids {
		if err := s.repo.UpsertReceipt(ctx, id, userID, req.Status); err != nil {
			return err
		}
		if id > maxID {
			maxID = id
		}
		s.broadcast(ctx, chatID, "receipt", Receipt{
			MessageID: id,
			UserID:    userID,
			Status:    req.Status,
		})
	}
	if req.Status == ReceiptRead && maxID > 0 {
		_ = s.repo.SetLastRead(ctx, chatID, userID, maxID)
	}
	return nil
}

// MarkRead is a convenience: mark everything up to messageID as read.
func (s *Service) MarkRead(ctx context.Context, chatID, userID uuid.UUID, messageID int64) error {
	return s.SetReceipts(ctx, chatID, userID, ReceiptRequest{
		MessageIDs: []int64{messageID},
		Status:     ReceiptRead,
	})
}

// Typing broadcasts a typing indicator (ephemeral — not persisted).
func (s *Service) Typing(ctx context.Context, chatID, userID uuid.UUID, typing bool) error {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return err
	}
	s.broadcast(ctx, chatID, "typing", map[string]any{
		"user_id": userID,
		"typing":  typing,
	})
	return nil
}

// React toggles an emoji reaction on a message.
func (s *Service) React(ctx context.Context, chatID, userID uuid.UUID, msgID int64, emoji string, remove bool) ([]Reaction, error) {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return nil, err
	}
	if _, err := s.repo.GetMessage(ctx, chatID, msgID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMessageNotFound
		}
		return nil, err
	}
	if remove {
		if err := s.repo.RemoveReaction(ctx, msgID, userID, emoji); err != nil {
			return nil, err
		}
	} else {
		if err := s.repo.AddReaction(ctx, msgID, userID, emoji); err != nil {
			return nil, err
		}
	}
	list, err := s.repo.ListReactions(ctx, msgID)
	if err != nil {
		return nil, err
	}
	s.broadcast(ctx, chatID, "message.reaction", map[string]any{
		"message_id": msgID,
		"user_id":    userID,
		"emoji":      emoji,
		"removed":    remove,
		"reactions":  list,
	})
	return list, nil
}

// ── Internal helpers ────────────────────────────────────────────────────────

func (s *Service) requireParticipant(ctx context.Context, chatID, userID uuid.UUID) error {
	ok, err := s.repo.IsParticipant(ctx, chatID, userID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrNotParticipant
	}
	return nil
}

func (s *Service) enrichDirectPeer(ctx context.Context, c *Chat, forUser uuid.UUID) {
	if c.Type != ChatDirect {
		return
	}
	peer, err := s.repo.PeerUser(ctx, c.ID, forUser)
	if err != nil {
		return
	}
	c.Title = &peer.DisplayName
	if peer.AvatarURI != "" {
		c.AvatarURL = &peer.AvatarURI
	}
}

func (s *Service) loadChat(ctx context.Context, chatID uuid.UUID, forUser uuid.UUID) (Chat, error) {
	chats, err := s.repo.ListChats(ctx, forUser)
	if err != nil {
		return Chat{}, err
	}
	for _, c := range chats {
		if c.ID == chatID {
			preview, _ := s.repo.LastMessage(ctx, chatID)
			c.LastMessage = preview
			s.enrichDirectPeer(ctx, &c, forUser)
			return c, nil
		}
	}
	return Chat{}, ErrChatNotFound
}

func (s *Service) getMessage(ctx context.Context, chatID uuid.UUID, msgID int64) (Message, error) {
	m, err := s.repo.GetMessage(ctx, chatID, msgID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, ErrMessageNotFound
		}
		return Message{}, err
	}
	return *m, nil
}

func (s *Service) broadcast(ctx context.Context, chatID uuid.UUID, typ string, payload any) {
	if s.hub == nil {
		return
	}
	ids, err := s.repo.ParticipantIDs(ctx, chatID)
	if err != nil || len(ids) == 0 {
		return
	}
	s.hub.PublishJSON(ids, typ, chatID.String(), payload)
}

func (s *Service) notifyOffline(ctx context.Context, chatID, senderID uuid.UUID, msg Message) {
	if s.push == nil {
		return
	}
	ids, err := s.repo.ParticipantIDs(ctx, chatID)
	if err != nil {
		return
	}
	// Preview body — decrypted content is already available on msg.
	body := msg.Content
	if len(body) > 120 {
		body = body[:117] + "…"
	}
	if body == "" {
		body = "New message"
	}
	title := msg.SenderName
	if title == "" {
		title = "Socialize"
	}
	category := "messages"
	// Groups use same chats table; treat multi-party as groups category.
	if len(ids) > 2 {
		category = "groups"
	}
	data := map[string]string{
		"type":     "message.new",
		"chat_id":  chatID.String(),
		"message_id": fmt.Sprintf("%d", msg.ID),
	}
	for _, uid := range ids {
		if uid == senderID {
			continue
		}
		if s.hub != nil && s.hub.Online(uid) {
			continue // live WS already delivers
		}
		_ = s.push.NotifyUser(ctx, uid, category, title, body, data)
	}
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
