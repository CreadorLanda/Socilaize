package whatsapp

import (
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
		// Linking failures are usually upstream (WhatsApp servers, network).
		// We don't try to distinguish — the client polls /status for detail.
		ctx.JSON(http.StatusBadGateway, gin.H{"error": "pairing_failed", "detail": err.Error()})
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
