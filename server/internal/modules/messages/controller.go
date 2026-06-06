package messages

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/CreadorLanda/Socilaize/server/internal/middleware"
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
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, CreateChatResponse{ChatID: chat.ID, Chat: chat})
}

// GetChats — GET /chats
func (c *Controller) GetChats(ctx *gin.Context) {
	chats, err := c.svc.ListChats(ctx.Request.Context(), middleware.UserIDFrom(ctx))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
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
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusCreated, msg)
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
	msgs, err := c.svc.ListMessages(ctx.Request.Context(), chatID, limit, before)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if msgs == nil {
		msgs = []Message{}
	}
	ctx.JSON(http.StatusOK, msgs)
}
