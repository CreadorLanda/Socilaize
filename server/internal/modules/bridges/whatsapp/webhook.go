package whatsapp

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// WebhookController is the inbound side of the bridge — events posted by
// the wa-bridge sidecar (pair_success, pair_error, logged_out, etc.). It
// shares the InternalToken with the outbound Manager so a single secret
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

	// We don't know the event shape up front — peek the type field, then
	// re-decode into the right struct. This keeps adding new events later
	// (messages, presence) cheap.
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

	// Short ctx for DB work — we want the sidecar's webhook caller to
	// release quickly even if Postgres is sluggish.
	work, cancel := context.WithTimeout(ctx.Request.Context(), 5*time.Second)
	defer cancel()

	switch peek.Type {
	case "pair_success":
		var evt struct {
			JID string `json:"jid"`
		}
		_ = json.Unmarshal(raw, &evt)
		if err := c.repo.MarkLinked(work, userID, evt.JID); err != nil {
			log.Error().Err(err).Str("user", userID.String()).Msg("wa-webhook: mark linked")
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "db_error"})
			return
		}
		log.Info().Str("user", userID.String()).Str("jid", evt.JID).Msg("wa-webhook: pair_success")

	case "pair_error":
		var evt struct {
			Reason string `json:"reason"`
		}
		_ = json.Unmarshal(raw, &evt)
		_ = c.repo.MarkFailed(work, userID, evt.Reason)
		log.Warn().Str("user", userID.String()).Str("reason", evt.Reason).Msg("wa-webhook: pair_error")

	case "logged_out":
		_ = c.repo.MarkDisconnected(work, userID)
		log.Info().Str("user", userID.String()).Msg("wa-webhook: logged_out")

	case "connection":
		// Informational only — useful for debugging, no DB change yet.
		var evt struct {
			State string `json:"state"`
		}
		_ = json.Unmarshal(raw, &evt)
		log.Debug().Str("user", userID.String()).Str("state", evt.State).Msg("wa-webhook: connection")

	default:
		log.Warn().Str("type", peek.Type).Msg("wa-webhook: unknown event type")
	}

	ctx.Status(http.StatusNoContent)
}
