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
	ErrInvalidReport    = errors.New("invalid_report")
	ErrNotSender        = errors.New("not_message_sender")
	ErrInvalidReceipt   = errors.New("invalid_receipt_status")
	ErrViewsExhausted   = errors.New("views_exhausted")
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

	// Tell the person who asked.
	//
	// Being accepted is the one moment in this flow the requester cannot
	// discover on their own: nothing arrives, the chat simply stops being
	// pending. Without this they have to keep reopening it to find out.
	accepter, err := s.users.ByID(ctx, userID)
	name := "Someone"
	if err == nil && accepter != nil && accepter.DisplayName != "" {
		name = accepter.DisplayName
	}
	s.notifyChatAccepted(ctx, chatID, chat.CreatedBy, name)

	// The requester's open screen should stop showing a pending banner
	// without waiting for a refresh.
	s.broadcast(ctx, chatID, "chat.accepted", map[string]any{
		"chat_id":     chatID.String(),
		"accepted_by": userID.String(),
	})

	return s.loadChat(ctx, chatID, userID)
}

// notifyChatAccepted pushes to the requester only. The accepter performed the
// action and needs no telling.
func (s *Service) notifyChatAccepted(ctx context.Context, chatID, requester uuid.UUID, accepterName string) {
	if s.push == nil {
		return
	}
	if s.hub != nil && s.hub.Online(requester) {
		// The broadcast above already reached them.
		return
	}
	_ = s.push.NotifyUser(ctx, requester, "messages",
		accepterName, "accepted your request",
		map[string]string{"type": "chat.accepted", "chat_id": chatID.String()})
}

// BlockChat marks a chat blocked. Any participant may block.
func (s *Service) BlockChat(ctx context.Context, chatID, userID uuid.UUID) error {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return err
	}
	return s.repo.UpdateChatStatus(ctx, chatID, ChatStatusBlocked)
}

// ListChats returns one page of the caller's chats. The preview, unread
// count and peer are resolved inside the repository query — no per-chat
// round trips.
func (s *Service) ListChats(ctx context.Context, userID uuid.UUID, opts ListChatsOptions) ([]Chat, error) {
	opts.Normalize()
	return s.repo.ListChats(ctx, userID, opts)
}

// UpdateChatSettings toggles pin / mute / archive for the caller only.
func (s *Service) UpdateChatSettings(ctx context.Context, chatID, userID uuid.UUID, req ChatSettingsRequest) (Chat, error) {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return Chat{}, err
	}
	if err := s.repo.UpdateChatSettings(ctx, chatID, userID, req); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Chat{}, ErrChatNotFound
		}
		return Chat{}, err
	}
	return s.loadChat(ctx, chatID, userID)
}

// ClearChatHistory hides existing messages from the caller only.
func (s *Service) ClearChatHistory(ctx context.Context, chatID, userID uuid.UUID) error {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return err
	}
	if err := s.repo.ClearHistory(ctx, chatID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrChatNotFound
		}
		return err
	}
	return nil
}

// DeleteChat removes the chat from the caller's list and clears their copy
// of the history. The peer is unaffected, and the chat returns if they write.
func (s *Service) DeleteChat(ctx context.Context, chatID, userID uuid.UUID) error {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return err
	}
	if err := s.repo.HideChat(ctx, chatID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrChatNotFound
		}
		return err
	}
	return nil
}

// MessageInfo returns per-recipient delivery detail. Restricted to the
// sender: who read your message is yours to see, not the whole chat's.
func (s *Service) MessageInfo(ctx context.Context, chatID uuid.UUID, messageID int64, caller uuid.UUID) ([]ReceiptDetail, error) {
	if err := s.requireParticipant(ctx, chatID, caller); err != nil {
		return nil, err
	}
	sender, owningChat, err := s.repo.MessageSender(ctx, messageID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMessageNotFound
		}
		return nil, err
	}
	if owningChat != chatID {
		return nil, ErrMessageNotFound
	}
	if sender != caller {
		return nil, ErrNotSender
	}
	return s.repo.MessageReceipts(ctx, messageID)
}

// OpenLimitedMessage consumes one view of a limited-view message and
// reports what is left. Returns ErrViewsExhausted once the recipient has
// used them all, so the client can render the burnt state instead of the
// content.
func (s *Service) OpenLimitedMessage(ctx context.Context, chatID uuid.UUID, messageID int64, viewer uuid.UUID) (*int, *int, error) {
	if err := s.requireParticipant(ctx, chatID, viewer); err != nil {
		return nil, nil, err
	}
	limit, left, err := s.repo.RegisterView(ctx, messageID, viewer)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrMessageNotFound
		}
		// Includes ErrViewsExhausted, which the repository decides because
		// only it can tell "this was the last view" from "there was none
		// left" without a second query racing the first.
		return limit, left, err
	}
	return limit, left, nil
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
	// One more hop than the client claims, and never fewer than zero. Taking
	// the number at face value would let a client reset a chain that has been
	// round the block ten times back to "written just for you".
	// The field being present is what marks this as a forward; its value is
	// the count the source carried. Gating on "> 0" instead meant a channel
	// post — which carries zero, being first-hand where it stands — could
	// never reach one hop, and a chat message at one hop jumped to two.
	origin := Origin{}
	if req.ForwardCount != nil {
		origin.ForwardCount = *req.ForwardCount + 1
	}
	origin.ChannelID = req.SourceChannelID
	origin.PostID = req.SourcePostID

	id, err := s.repo.InsertMessage(ctx, chatID, senderID, req.Content, msgType,
		req.ReplyToID, req.ViewLimit, origin)
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
	// The other half of the bargain: with read receipts off you do not see
	// anyone else's either. Enforced on the way out rather than by asking
	// the client to hide them, because a setting the client enforces is a
	// setting the client can decline to enforce.
	hideRead := false
	if u, err := s.users.ByID(ctx, userID); err == nil && !u.ReadReceipts {
		if chat, err := s.repo.ChatForUser(ctx, chatID, userID); err == nil && chat.Type == ChatDirect {
			hideRead = true
		}
	}

	msgs, err := s.repo.ListMessages(ctx, chatID, userID, limit, before, hideRead)
	if err != nil {
		return nil, err
	}
	s.attachPollTallies(ctx, userID, msgs)
	return msgs, nil
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

	// Read receipts are reciprocal, and only in one-to-one chats — the same
	// bargain other messengers strike. With them off, a "read" is recorded
	// as no more than delivered: you cannot withhold yours and still send
	// them, or the setting would mean nothing.
	//
	// Groups are exempt because a group read receipt is about a room rather
	// than about you, and hiding one person's would make the rest wrong.
	if req.Status == ReceiptRead {
		if chat, err := s.repo.ChatForUser(ctx, chatID, userID); err == nil && chat.Type == ChatDirect {
			if u, err := s.users.ByID(ctx, userID); err == nil && !u.ReadReceipts {
				req.Status = ReceiptDelivered
			}
		}
	}
	ids, err := s.repo.MessageIDsInChat(ctx, chatID, req.MessageIDs)
	if err != nil {
		return err
	}
	// Reading is what starts a disappearing message's clock. Done here
	// rather than in the client so it cannot be skipped by not asking.
	if req.Status == ReceiptRead {
		if sec, err := s.repo.DisappearSeconds(ctx, chatID); err == nil && sec > 0 {
			_ = s.repo.StartExpiryClock(ctx, ids, sec)
		}
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

// Typing broadcasts a composing indicator (ephemeral — not persisted).
//
// `kind` says what they are doing: composing text, or holding the mic. Anything
// unrecognised is treated as typing, which is what an older client sends.
func (s *Service) Typing(ctx context.Context, chatID, userID uuid.UUID, typing bool, kind string) error {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return err
	}
	if kind != "recording" {
		kind = "typing"
	}
	s.broadcast(ctx, chatID, "typing", map[string]any{
		"user_id": userID,
		"typing":  typing,
		"kind":    kind,
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
	id := peer.ID
	c.PeerUserID = &id
	uname := peer.Username
	c.PeerUsername = &uname
}

func (s *Service) loadChat(ctx context.Context, chatID uuid.UUID, forUser uuid.UUID) (Chat, error) {
	c, err := s.repo.ChatForUser(ctx, chatID, forUser)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Chat{}, ErrChatNotFound
		}
		return Chat{}, err
	}
	return *c, nil
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
		"type":       "message.new",
		"chat_id":    chatID.String(),
		"message_id": fmt.Sprintf("%d", msg.ID),
	}
	for _, uid := range ids {
		if uid == senderID {
			continue
		}
		if s.hub != nil && s.hub.Online(uid) {
			continue // live WS already delivers
		}
		// Respect a per-user mute on this chat.
		if muted, err := s.repo.IsMuted(ctx, chatID, uid); err == nil && muted {
			continue
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

// VotePoll records the caller's selections on a poll message.
//
// A separate endpoint rather than an edit of the message: editing is the
// author's alone, so voting on someone else's poll was rejected outright —
// and the body is end-to-end encrypted, so the server could not have merged
// a tally into it even for the author.
func (s *Service) VotePoll(ctx context.Context, chatID, userID uuid.UUID, msgID int64, optionIDs []string) (*PollTally, error) {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return nil, err
	}
	ids, err := s.repo.MessageIDsInChat(ctx, chatID, []int64{msgID})
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, ErrMessageNotFound
	}
	if err := s.repo.SetPollVotes(ctx, msgID, userID, optionIDs); err != nil {
		return nil, err
	}
	tallies, err := s.repo.PollTallies(ctx, []int64{msgID}, userID)
	if err != nil {
		return nil, err
	}
	t := tallies[msgID]
	if t == nil {
		t = &PollTally{Counts: map[string]int{}, Mine: []string{}}
	}
	s.broadcast(ctx, chatID, "poll.voted", map[string]any{
		"message_id": msgID,
		"poll_votes": t,
	})
	return t, nil
}

// attachPollTallies fills PollVotes on every poll message in a page.
//
// Without it a reload showed zero votes on every poll: the counts live in
// their own table now, so nothing in the message body carries them.
func (s *Service) attachPollTallies(ctx context.Context, userID uuid.UUID, msgs []Message) {
	var ids []int64
	for i := range msgs {
		if msgs[i].MessageType == MsgPoll {
			ids = append(ids, msgs[i].ID)
		}
	}
	if len(ids) == 0 {
		return
	}
	tallies, err := s.repo.PollTallies(ctx, ids, userID)
	if err != nil {
		return // tallies are cosmetic; never fail a history load over them
	}
	for i := range msgs {
		if t := tallies[msgs[i].ID]; t != nil {
			msgs[i].PollVotes = t
		}
	}
}

// ReportChat files a moderation report, optionally blocking the chat too.
//
// Blocking in the same call is deliberate: reporting someone and then still
// hearing from them is the worst outcome for the person doing it, and making
// it two separate taps means some people only manage the first.
func (s *Service) ReportChat(ctx context.Context, chatID, userID uuid.UUID, reason, note string, alsoBlock bool) error {
	if err := s.requireParticipant(ctx, chatID, userID); err != nil {
		return err
	}
	if reason == "" {
		return ErrInvalidReport
	}
	if err := s.repo.InsertReport(ctx, chatID, userID, reason, note); err != nil {
		return err
	}
	if alsoBlock {
		return s.BlockChat(ctx, chatID, userID)
	}
	return nil
}
