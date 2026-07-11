package messages

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/CreadorLanda/Socilaize/server/internal/middleware"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/users"
)

type Controller struct {
	svc *Service
}

func NewController(svc *Service) *Controller { return &Controller{svc: svc} }

// PostSessionInit — POST /sessions/init
func (c *Controller) PostSessionInit(ctx *gin.Context) {
	var req SessionInitRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	res, err := c.svc.InitSession(ctx.Request.Context(), middleware.UserIDFrom(ctx), req.PeerUsername)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, res)
}

// PostChat — POST /chats
func (c *Controller) PostChat(ctx *gin.Context) {
	var req CreateChatRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	chat, err := c.svc.CreateDirectChat(ctx.Request.Context(), middleware.UserIDFrom(ctx), req.PeerUserID)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusCreated, CreateChatResponse{ChatID: chat.ID, Chat: chat})
}

// GetChats — GET /chats
func (c *Controller) GetChats(ctx *gin.Context) {
	chats, err := c.svc.ListChats(ctx.Request.Context(), middleware.UserIDFrom(ctx))
	if err != nil {
		writeErr(ctx, err)
		return
	}
	if chats == nil {
		chats = []Chat{}
	}
	ctx.JSON(http.StatusOK, chats)
}

// PostMessage — POST /chats/:id/messages
func (c *Controller) PostMessage(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_chat_id"})
		return
	}
	var req SendMessageRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	msg, err := c.svc.SendMessage(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), req)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusCreated, msg)
}

// PostAcceptChat — POST /chats/:id/accept
func (c *Controller) PostAcceptChat(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_chat_id"})
		return
	}
	chat, err := c.svc.AcceptChat(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx))
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, chat)
}

// PostBlockChat — POST /chats/:id/block
func (c *Controller) PostBlockChat(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_chat_id"})
		return
	}
	if err := c.svc.BlockChat(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx)); err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.Status(http.StatusNoContent)
}

// GetMessages — GET /chats/:id/messages?limit=50&before=<id>
func (c *Controller) GetMessages(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_chat_id"})
		return
	}
	limit := 50
	before := int64(0)
	if l := ctx.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if b := ctx.Query("before"); b != "" {
		if parsed, err := strconv.ParseInt(b, 10, 64); err == nil {
			before = parsed
		}
	}
	msgs, err := c.svc.ListMessages(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), limit, before)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	if msgs == nil {
		msgs = []Message{}
	}
	ctx.JSON(http.StatusOK, msgs)
}

func writeErr(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrChatNotFound), errors.Is(err, users.ErrNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ErrNotParticipant), errors.Is(err, ErrCannotAcceptOwn):
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, ErrChatBlocked):
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, ErrPendingChatLimit), errors.Is(err, ErrChatNotPending):
		ctx.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
	}
}
