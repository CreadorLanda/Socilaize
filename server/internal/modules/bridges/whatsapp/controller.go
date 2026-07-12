package whatsapp

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/CreadorLanda/Socilaize/server/internal/middleware"
)

type Controller struct {
	svc *Service
}

func NewController(svc *Service) *Controller { return &Controller{svc: svc} }

// PostLink kicks off (or restarts) phone-pairing for the caller. The
// pairing code is returned synchronously — the user types it into
// WhatsApp → Linked devices → Link with phone number.
func (c *Controller) PostLink(ctx *gin.Context) {
	var req LinkRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	res, err := c.svc.Link(ctx.Request.Context(), middleware.UserIDFrom(ctx), req.Phone)
	if err != nil {
		switch {
		case errors.Is(err, ErrPairingRateLimited):
			// 429 with a hint — try again in ~30s; usually it's WhatsApp's
			// per-IP cooldown after repeated attempts.
			ctx.JSON(http.StatusTooManyRequests, gin.H{"error": "pairing_rate_limited"})
		case errors.Is(err, ErrPhoneNotOnWhatsApp):
			// 422 — the number itself is rejected by WhatsApp, not a server
			// problem. The client can prompt for a different number.
			ctx.JSON(http.StatusUnprocessableEntity, gin.H{"error": "phone_not_on_whatsapp"})
		default:
			ctx.JSON(http.StatusBadGateway, gin.H{"error": "pairing_failed", "detail": err.Error()})
		}
		return
	}
	ctx.JSON(http.StatusOK, res)
}

// GetStatus — the polled view, including any pending pairing code that
// hasn't yet been used.
func (c *Controller) GetStatus(ctx *gin.Context) {
	res, err := c.svc.Status(ctx.Request.Context(), middleware.UserIDFrom(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	ctx.JSON(http.StatusOK, res)
}

// DeleteLink unlinks the bridge — logs out from WhatsApp and drops our row.
func (c *Controller) DeleteLink(ctx *gin.Context) {
	if err := c.svc.Unlink(ctx.Request.Context(), middleware.UserIDFrom(ctx)); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error", "detail": err.Error()})
		return
	}
	ctx.Status(http.StatusNoContent)
}

// GetChats — GET /bridges/whatsapp/chats
func (c *Controller) GetChats(ctx *gin.Context) {
	list, err := c.svc.ListChats(ctx.Request.Context(), middleware.UserIDFrom(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	if list == nil {
		list = []ChatSummary{}
	}
	ctx.JSON(http.StatusOK, list)
}

// GetMessages — GET /bridges/whatsapp/messages?jid=
func (c *Controller) GetMessages(ctx *gin.Context) {
	jid := ctx.Query("jid")
	list, err := c.svc.ListMessages(ctx.Request.Context(), middleware.UserIDFrom(ctx), jid)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if list == nil {
		list = []StoredMessage{}
	}
	ctx.JSON(http.StatusOK, list)
}

// PostMessage — POST /bridges/whatsapp/messages { jid, text, type?, media_url? }
func (c *Controller) PostMessage(ctx *gin.Context) {
	var body SendRequest
	if err := ctx.ShouldBindJSON(&body); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	msg, err := c.svc.SendMessage(ctx.Request.Context(), middleware.UserIDFrom(ctx), body)
	if err != nil {
		switch err.Error() {
		case "bridge_not_linked":
			ctx.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		case "empty_message", "invalid_chat_jid", "missing_media_url",
			"invalid_media_url", "invalid_message_type", "media_disabled":
			ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		default:
			ctx.JSON(http.StatusBadGateway, gin.H{"error": "send_failed", "detail": err.Error()})
		}
		return
	}
	ctx.JSON(http.StatusCreated, msg)
}
