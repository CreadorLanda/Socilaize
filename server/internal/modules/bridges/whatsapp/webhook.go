package whatsapp

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// maxReasonableMsgLen is a safety cap above our DB limit of 64 KB. If the
// sidecar sends something wildly oversized we reject it early instead of
// letting the DB truncation be the only guard.
const maxReasonableMsgLen = 65536 + 1024 // 64 KB + 1 KB slack

// validJID reports whether s looks like a WhatsApp JID (user@domain).
// This is the same pattern enforced by the DB CHECK constraint, kept in
// sync here so we can reject before the round-trip.
func validJID(s string) bool {
	if len(s) < 5 || len(s) > 128 {
		return false
	}
	at := strings.IndexByte(s, '@')
	if at < 1 || at >= len(s)-2 {
		return false
	}
	// Basic — the DB regex does a tighter check; this is just an early
	// filter to keep garbage out of log lines.
	for _, c := range s[:at] {
		if c > 127 {
			return false
		}
	}
	return true
}

// validMessageType returns true for known message types (mirrors the DB
// CHECK constraint).
func validMessageType(t string) bool {
	switch t {
	case "text", "image", "video", "audio", "document", "sticker",
		"location", "contact", "link", "system", "unknown":
		return true
	default:
		return false
	}
}

// WebhookController is the inbound side of the bridge — events posted by
// the wa-bridge sidecar (pair_success, pair_error, logged_out, message).
// It shares the InternalToken with the outbound Manager so a single secret
// guards both directions.
type WebhookController struct {
	repo  *Repository
	token string
}

func NewWebhookController(repo *Repository, internalToken string) *WebhookController {
	return &WebhookController{repo: repo, token: internalToken}
}

// PostEvent is mounted at /api/internal/wa/events. The sidecar is the only
// thing that should ever call it — the Bearer guard enforces that.
func (c *WebhookController) PostEvent(ctx *gin.Context) {
	auth := ctx.GetHeader("Authorization")
	if auth != "Bearer "+c.token {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	raw, err := ctx.GetRawData()
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	var peek struct {
		Type   string `json:"type"`
		UserID string `json:"user_id"`
	}
	if err := json.Unmarshal(raw, &peek); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_json"})
		return
	}
	userID, err := uuid.Parse(peek.UserID)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_user_id"})
		return
	}

	work, cancel := context.WithTimeout(ctx.Request.Context(), 5*time.Second)
	defer cancel()

	switch peek.Type {
	case "pair_success":
		c.handlePairSuccess(work, raw, userID, ctx)
		return

	case "pair_error":
		c.handlePairError(work, raw, userID)

	case "logged_out":
		_ = c.repo.MarkDisconnected(work, userID)
		log.Info().Str("user", userID.String()).Msg("wa-webhook: logged_out")

	case "connection":
		var evt struct {
			State string `json:"state"`
		}
		_ = json.Unmarshal(raw, &evt)
		log.Debug().Str("user", userID.String()).Str("state", evt.State).Msg("wa-webhook: connection")

	case "message":
		c.handleMessage(work, raw, userID, ctx)
		return

	default:
		log.Warn().Str("type", peek.Type).Msg("wa-webhook: unknown event type")
	}

	ctx.Status(http.StatusNoContent)
}

func (c *WebhookController) handlePairSuccess(ctx context.Context, raw []byte, userID uuid.UUID, ginCtx *gin.Context) {
	var evt struct {
		JID string `json:"jid"`
	}
	_ = json.Unmarshal(raw, &evt)

	if !validJID(evt.JID) {
		log.Warn().Str("user", userID.String()).Str("jid", evt.JID).Msg("wa-webhook: pair_success with invalid jid")
		ginCtx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_jid"})
		return
	}

	if err := c.repo.MarkLinked(ctx, userID, evt.JID); err != nil {
		log.Error().Err(err).Str("user", userID.String()).Msg("wa-webhook: mark linked")
		ginCtx.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
		return
	}
	log.Info().Str("user", userID.String()).Str("jid", evt.JID).Msg("wa-webhook: pair_success")
	ginCtx.Status(http.StatusNoContent)
}

func (c *WebhookController) handlePairError(ctx context.Context, raw []byte, userID uuid.UUID) {
	var evt struct {
		Reason string `json:"reason"`
	}
	_ = json.Unmarshal(raw, &evt)
	_ = c.repo.MarkFailed(ctx, userID, evt.Reason)
	log.Warn().Str("user", userID.String()).Str("reason", evt.Reason).Msg("wa-webhook: pair_error")
}

// handleMessage validates and persists an incoming WhatsApp message.
//
// Security:
//   - JIDs are validated against a basic pattern; garbage is rejected.
//   - Content over ~65 KB is rejected (DB constraint + early guard).
//   - message_type is checked against the known set.
//   - wa_message_id uniqueness is enforced by the DB (ON CONFLICT DO NOTHING).
//   - The event is never logged with full content — only ids and types.
func (c *WebhookController) handleMessage(ctx context.Context, raw []byte, userID uuid.UUID, ginCtx *gin.Context) {
	var evt struct {
		WaMessageID string `json:"wa_message_id"`
		ChatJID     string `json:"chat_jid"`
		SenderJID   string `json:"sender_jid"`
		Content     string `json:"content"`
		MediaURL    string `json:"media_url"`
		MessageType string `json:"message_type"`
		WaTimestamp int64  `json:"wa_timestamp"`
	}
	if err := json.Unmarshal(raw, &evt); err != nil {
		log.Warn().Err(err).Str("user", userID.String()).Msg("wa-webhook: message unmarshal failed")
		ginCtx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_message_json"})
		return
	}

	// ── Validation ────────────────────────────────────────────────────────

	if evt.WaMessageID == "" {
		ginCtx.JSON(http.StatusBadRequest, gin.H{"error": "missing_wa_message_id"})
		return
	}
	if !validJID(evt.ChatJID) {
		ginCtx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_chat_jid"})
		return
	}
	if !validJID(evt.SenderJID) {
		ginCtx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_sender_jid"})
		return
	}
	if !validMessageType(evt.MessageType) {
		ginCtx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_message_type"})
		return
	}
	if len(evt.Content) > maxReasonableMsgLen {
		log.Warn().Int("len", len(evt.Content)).Str("user", userID.String()).Msg("wa-webhook: content too large")
		ginCtx.JSON(http.StatusBadRequest, gin.H{"error": "content_too_large"})
		return
	}
	if evt.WaTimestamp <= 0 {
		evt.WaTimestamp = time.Now().Unix()
	}

	msg := IncomingMessage{
		WaMessageID: evt.WaMessageID,
		ChatJID:     evt.ChatJID,
		SenderJID:   evt.SenderJID,
		Content:     evt.Content,
		MediaURL:    evt.MediaURL,
		MessageType: evt.MessageType,
		WaTimestamp: evt.WaTimestamp,
	}

	if err := c.repo.InsertMessage(ctx, userID, msg); err != nil {
		// UNIQUE constraint violation on wa_message_id is expected during
		// re-delivery — treat as success.
		if strings.Contains(err.Error(), "uq_wa_messages_wa_id") {
			log.Debug().Str("wa_id", evt.WaMessageID).Str("user", userID.String()).Msg("wa-webhook: duplicate message (ignored)")
			ginCtx.Status(http.StatusNoContent)
			return
		}
		log.Error().Err(err).Str("user", userID.String()).Str("wa_id", evt.WaMessageID).Msg("wa-webhook: insert message failed")
		ginCtx.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
		return
	}

	log.Debug().
		Str("user", userID.String()).
		Str("wa_id", evt.WaMessageID).
		Str("chat", evt.ChatJID).
		Str("type", evt.MessageType).
		Msg("wa-webhook: message stored")
	ginCtx.Status(http.StatusNoContent)
}
