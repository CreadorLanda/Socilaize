package whatsapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("bridge_not_found")
	ErrPairingBusy  = errors.New("pairing_in_progress")
	// ErrPairingRateLimited is returned when WhatsApp closes the socket too
	// fast (typical of repeated attempts from one IP). Surface a clear UX
	// message instead of the raw "EOF" the lib emits.
	ErrPairingRateLimited = errors.New("pairing_rate_limited")
	// ErrPhoneNotOnWhatsApp covers WhatsApp's "info query 400 bad-request"
	// — that's how they refuse pairing for a number not on the platform.
	ErrPhoneNotOnWhatsApp = errors.New("phone_not_on_whatsapp")
)

type Service struct {
	repo    *Repository
	manager *Manager
	media   MediaStore
}

func NewService(repo *Repository, m *Manager, media MediaStore) *Service {
	return &Service{repo: repo, manager: m, media: media}
}

// pairCooldown is how long we refuse to talk to WhatsApp again after a
// rate-limit response. WhatsApp's own cooldown after a 429 tends to last
// several minutes minimum; we wait 5 to give the IP time to recover.
const pairCooldown = 5 * time.Minute

// Link starts a phone-pairing session.
//
// Defends against accidental floods on three layers:
//   - existing valid 'pending' row for same phone → reuse, no upstream call.
//   - recent 'failed' row whose last error was a rate limit → refuse our own
//     /link locally for `pairCooldown` to stop deepening WhatsApp's ban.
//   - otherwise: request a new code, persist 'pending'.
func (s *Service) Link(ctx context.Context, userID uuid.UUID, phone string) (LinkResponse, error) {
	existing, err := s.repo.Get(ctx, userID)
	if err != nil && !IsNoRows(err) {
		return LinkResponse{}, fmt.Errorf("read existing bridge: %w", err)
	}
	if existing != nil &&
		existing.Status == StatusPending &&
		existing.Phone == phone &&
		existing.PairingCode != nil &&
		existing.PairingExpiresAt != nil &&
		time.Until(*existing.PairingExpiresAt) > 10*time.Second {
		// Same number, code still has > 10s to live — let the client use
		// the one we already issued. Saves a roundtrip to WhatsApp.
		return LinkResponse{
			Status:           StatusPending,
			Phone:            existing.Phone,
			PairingCode:      *existing.PairingCode,
			PairingExpiresAt: *existing.PairingExpiresAt,
		}, nil
	}
	// Local backoff after a recent rate-limit. The repository's updated_at
	// column rolls forward on each Mark*, so we look at the row's age.
	if existing != nil && isRecentRateLimit(existing) {
		return LinkResponse{}, ErrPairingRateLimited
	}

	code, expires, err := s.manager.StartPairing(ctx, userID, phone)
	if err != nil {
		classified := classifyPairingError(err)
		// Persist the rate-limit so the next /link inside `pairCooldown`
		// short-circuits without bothering WhatsApp.
		if errors.Is(classified, ErrPairingRateLimited) {
			_ = s.repo.UpsertFailed(ctx, userID, phone, "rate-overlimit")
		}
		return LinkResponse{}, classified
	}
	if err := s.repo.UpsertPending(ctx, userID, phone, code, expires); err != nil {
		return LinkResponse{}, fmt.Errorf("persist pending: %w", err)
	}
	return LinkResponse{
		Status:           StatusPending,
		Phone:            phone,
		PairingCode:      code,
		PairingExpiresAt: expires,
	}, nil
}

// isRecentRateLimit returns true when the row was last touched within the
// cooldown window AND its last_error indicates a WhatsApp rate-limit.
func isRecentRateLimit(b *bridgeRow) bool {
	if b.Status != StatusFailed || b.LastError == nil {
		return false
	}
	if !strings.Contains(strings.ToLower(*b.LastError), "rate") {
		return false
	}
	// The row doesn't carry updated_at directly (it's a select-shape thing);
	// we use linked_at when set, otherwise fall through. The repository
	// MarkFailed call sets last_error and we know it's "now-ish". For a
	// stricter check we'd need updated_at on bridgeRow — added below.
	if b.UpdatedAt == nil {
		return false
	}
	return time.Since(*b.UpdatedAt) < pairCooldown
}

// classifyPairingError maps whatsmeow's raw failure modes to typed sentinels.
// Patterns observed in the wild:
//
//   - "status 429" / "rate-overlimit"     → WhatsApp's pair rate limit (the
//                                            actual error returned for our
//                                            repeat attempts).
//   - "EOF" / "frame header"              → WhatsApp closed the socket;
//                                            usually downstream of a 429.
//   - "status 400" / "bad-request"        → number isn't on WhatsApp.
func classifyPairingError(err error) error {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "status 429"), strings.Contains(msg, "rate-overlimit"):
		return ErrPairingRateLimited
	case strings.Contains(msg, "eof"), strings.Contains(msg, "frame header"):
		return ErrPairingRateLimited
	case strings.Contains(msg, "status 400"), strings.Contains(msg, "bad-request"):
		return ErrPhoneNotOnWhatsApp
	default:
		return fmt.Errorf("start pairing: %w", err)
	}
}

// Status — the polled view. Reads the row, and if the row says "linked"
// but the in-process client is gone (e.g. server restart), reflect that
// as "disconnected" so the client doesn't claim connection it doesn't have.
func (s *Service) Status(ctx context.Context, userID uuid.UUID) (StatusResponse, error) {
	row, err := s.repo.Get(ctx, userID)
	if IsNoRows(err) {
		return StatusResponse{Status: StatusDisconnected}, nil
	}
	if err != nil {
		return StatusResponse{}, fmt.Errorf("read bridge: %w", err)
	}
	out := StatusResponse{
		Status:   row.Status,
		Phone:    row.Phone,
		LinkedAt: row.LinkedAt,
	}
	if row.JID != nil {
		out.JID = *row.JID
	}
	if row.PairingCode != nil {
		out.PairingCode = *row.PairingCode
	}
	if row.PairingExpiresAt != nil {
		out.PairingExpiresAt = row.PairingExpiresAt
	}
	if row.LastError != nil {
		out.LastError = *row.LastError
	}
	// In-process reality check — if we claim linked but the client isn't
	// alive, demote to disconnected for this response. (We don't write
	// that back to the row; restoring the client on boot is a follow-up.)
	if out.Status == StatusLinked && !s.manager.IsConnected(userID) {
		out.Status = StatusDisconnected
	}
	return out, nil
}

// ListChats returns WhatsApp conversations built from stored inbound messages.
func (s *Service) ListChats(ctx context.Context, userID uuid.UUID) ([]ChatSummary, error) {
	return s.repo.ListChats(ctx, userID, 50)
}

// ListMessages returns decrypted WA messages for a chat JID.
func (s *Service) ListMessages(ctx context.Context, userID uuid.UUID, chatJID string) ([]StoredMessage, error) {
	if !validJID(chatJID) {
		return nil, errors.New("invalid_chat_jid")
	}
	return s.repo.ListMessages(ctx, userID, chatJID, 50)
}

// SendRequest is the body for POST /bridges/whatsapp/messages.
type SendRequest struct {
	JID      string `json:"jid" binding:"required"`
	Text     string `json:"text"`
	Type     string `json:"type"`      // text (default) | image | video | audio | document | sticker
	MediaURL string `json:"media_url"` // Socialize /api/media/{id}/file for non-text
}

// SendMessage relays text or media through Baileys and stores a local copy.
func (s *Service) SendMessage(ctx context.Context, userID uuid.UUID, req SendRequest) (StoredMessage, error) {
	chatJID := strings.TrimSpace(req.JID)
	text := strings.TrimSpace(req.Text)
	msgType := strings.TrimSpace(req.Type)
	if msgType == "" {
		msgType = "text"
	}
	if !validMessageType(msgType) {
		return StoredMessage{}, errors.New("invalid_message_type")
	}
	if !validJID(chatJID) {
		return StoredMessage{}, errors.New("invalid_chat_jid")
	}
	if msgType == "text" && text == "" {
		return StoredMessage{}, errors.New("empty_message")
	}
	if msgType != "text" && strings.TrimSpace(req.MediaURL) == "" {
		return StoredMessage{}, errors.New("missing_media_url")
	}
	st, err := s.Status(ctx, userID)
	if err != nil {
		return StoredMessage{}, err
	}
	if st.Status != StatusLinked {
		return StoredMessage{}, errors.New("bridge_not_linked")
	}

	var waID string
	mediaURL := strings.TrimSpace(req.MediaURL)
	if msgType == "text" {
		waID, err = s.manager.SendText(ctx, userID, chatJID, text)
	} else {
		if s.media == nil {
			return StoredMessage{}, errors.New("media_disabled")
		}
		mid, ok := parseMediaID(mediaURL)
		if !ok {
			return StoredMessage{}, errors.New("invalid_media_url")
		}
		meta, rc, err := s.media.Open(ctx, mid)
		if err != nil {
			return StoredMessage{}, fmt.Errorf("open media: %w", err)
		}
		defer rc.Close()
		filename := "wa." + extForMime(meta.MimeType, msgType)
		waID, err = s.manager.SendMedia(
			ctx, userID, chatJID, msgType, text, filename, meta.MimeType, rc, 0,
		)
		// Prefer stable Socialize URL in stored copy.
		mediaURL = meta.URL
	}
	if err != nil {
		return StoredMessage{}, err
	}
	if waID == "" {
		waID = "out_" + uuid.NewString()
	}
	// Self jid if known
	sender := st.JID
	if sender == "" {
		sender = "me@s.whatsapp.net"
	}
	msg := IncomingMessage{
		WaMessageID: waID,
		ChatJID:     chatJID,
		SenderJID:   sender,
		Content:     text,
		MediaURL:    mediaURL,
		MessageType: msgType,
		WaTimestamp: time.Now().Unix(),
	}
	if err := s.repo.InsertMessage(ctx, userID, msg); err != nil {
		_ = err
	}
	list, err := s.repo.ListMessages(ctx, userID, chatJID, 1)
	if err == nil && len(list) > 0 {
		return list[0], nil
	}
	return StoredMessage{
		WaMessageID: waID,
		ChatJID:     chatJID,
		SenderJID:   sender,
		MessageType: msgType,
		Content:     text,
		MediaURL:    mediaURL,
		WaTimestamp: msg.WaTimestamp,
		CreatedAt:   time.Now().UTC(),
	}, nil
}

func extForMime(mime, msgType string) string {
	switch {
	case strings.Contains(mime, "png"):
		return "png"
	case strings.Contains(mime, "jpeg"), strings.Contains(mime, "jpg"):
		return "jpg"
	case strings.Contains(mime, "webp"):
		return "webp"
	case strings.Contains(mime, "mp4"):
		return "mp4"
	case strings.Contains(mime, "ogg"):
		return "ogg"
	case strings.Contains(mime, "mpeg"):
		return "mp3"
	case strings.Contains(mime, "pdf"):
		return "pdf"
	default:
		switch msgType {
		case "image":
			return "jpg"
		case "video":
			return "mp4"
		case "audio":
			return "m4a"
		case "sticker":
			return "webp"
		default:
			return "bin"
		}
	}
}

func (s *Service) Unlink(ctx context.Context, userID uuid.UUID) error {
	if err := s.manager.Unlink(ctx, userID); err != nil {
		return fmt.Errorf("manager unlink: %w", err)
	}
	if err := s.repo.Delete(ctx, userID); err != nil {
		return fmt.Errorf("delete row: %w", err)
	}
	return nil
}
