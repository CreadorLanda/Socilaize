package messages

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/CreadorLanda/Socilaize/server/internal/middleware"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/users"
	"github.com/CreadorLanda/Socilaize/server/internal/platform/realtime"
	"github.com/CreadorLanda/Socilaize/server/internal/platform/tokens"
)

type Controller struct {
	svc    *Service
	hub    *realtime.Hub
	secret []byte
}

func NewController(svc *Service, hub *realtime.Hub, jwtSecret []byte) *Controller {
	return &Controller{svc: svc, hub: hub, secret: jwtSecret}
}

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

// PatchMessage — PATCH /chats/:id/messages/:mid
func (c *Controller) PatchMessage(ctx *gin.Context) {
	chatID, msgID, ok := parseChatMsg(ctx)
	if !ok {
		return
	}
	var req EditMessageRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	msg, err := c.svc.EditMessage(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), msgID, req.Content)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, msg)
}

// DeleteMessage — DELETE /chats/:id/messages/:mid
func (c *Controller) DeleteMessage(ctx *gin.Context) {
	chatID, msgID, ok := parseChatMsg(ctx)
	if !ok {
		return
	}
	msg, err := c.svc.DeleteMessage(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), msgID)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, msg)
}

// PostReceipts — POST /chats/:id/receipts
func (c *Controller) PostReceipts(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_chat_id"})
		return
	}
	var req ReceiptRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	if err := c.svc.SetReceipts(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), req); err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.Status(http.StatusNoContent)
}

// PostRead — POST /chats/:id/read
func (c *Controller) PostRead(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_chat_id"})
		return
	}
	var req MarkReadRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	if err := c.svc.MarkRead(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), req.MessageID); err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.Status(http.StatusNoContent)
}

// PostTyping — POST /chats/:id/typing
func (c *Controller) PostTyping(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_chat_id"})
		return
	}
	var req TypingRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	if err := c.svc.Typing(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), req.Typing); err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.Status(http.StatusNoContent)
}

// PostReact — POST /chats/:id/messages/:mid/reactions
func (c *Controller) PostReact(ctx *gin.Context) {
	chatID, msgID, ok := parseChatMsg(ctx)
	if !ok {
		return
	}
	var req ReactRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	list, err := c.svc.React(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), msgID, req.Emoji, false)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, list)
}

// DeleteReact — DELETE /chats/:id/messages/:mid/reactions?emoji=…
func (c *Controller) DeleteReact(ctx *gin.Context) {
	chatID, msgID, ok := parseChatMsg(ctx)
	if !ok {
		return
	}
	emoji := ctx.Query("emoji")
	if emoji == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "missing_emoji"})
		return
	}
	list, err := c.svc.React(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), msgID, emoji, true)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, list)
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

// GetWS — GET /ws  (token via query or Authorization)
// Upgrades to WebSocket. Auth middleware is not used so we parse the token
// ourselves (browsers cannot set headers on WS easily; mobile can use either).
func (c *Controller) GetWS(ctx *gin.Context) {
	if c.hub == nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{"error": "realtime_unavailable"})
		return
	}
	raw := ctx.Query("token")
	if raw == "" {
		h := ctx.GetHeader("Authorization")
		if len(h) > 7 && (h[:7] == "Bearer " || h[:7] == "bearer ") {
			raw = h[7:]
		}
	}
	if raw == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "missing_token"})
		return
	}
	claims, err := tokens.Parse(c.secret, raw)
	if err != nil || claims.Type != tokens.TypeAccess {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
		return
	}
	c.hub.ServeWS(ctx.Writer, ctx.Request, claims.UserID)
}

func parseChatMsg(ctx *gin.Context) (uuid.UUID, int64, bool) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_chat_id"})
		return uuid.Nil, 0, false
	}
	msgID, err := strconv.ParseInt(ctx.Param("mid"), 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_message_id"})
		return uuid.Nil, 0, false
	}
	return chatID, msgID, true
}

func writeErr(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrChatNotFound), errors.Is(err, users.ErrNotFound), errors.Is(err, ErrMessageNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ErrNotParticipant), errors.Is(err, ErrCannotAcceptOwn), errors.Is(err, ErrNotSender):
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, ErrChatBlocked):
		ctx.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	case errors.Is(err, ErrPendingChatLimit), errors.Is(err, ErrChatNotPending):
		ctx.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, ErrInvalidReceipt):
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
	}
}
