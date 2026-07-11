package messages

import "github.com/gin-gonic/gin"

// Register wires the messaging endpoints onto a protected router group
// (one that already has middleware.Auth applied).
//
// WebSocket is registered on the public api group via RegisterWS because
// the upgrade handshake often carries the JWT in a query param.
func Register(rg *gin.RouterGroup, c *Controller) {
	// Session init — E2EE key exchange.
	rg.POST("/sessions/init", c.PostSessionInit)

	// Chats
	rg.POST("/chats", c.PostChat)
	rg.GET("/chats", c.GetChats)

	// Messages within a chat
	rg.POST("/chats/:id/messages", c.PostMessage)
	rg.GET("/chats/:id/messages", c.GetMessages)
	rg.PATCH("/chats/:id/messages/:mid", c.PatchMessage)
	rg.DELETE("/chats/:id/messages/:mid", c.DeleteMessage)

	// Receipts / read / typing
	rg.POST("/chats/:id/receipts", c.PostReceipts)
	rg.POST("/chats/:id/read", c.PostRead)
	rg.POST("/chats/:id/typing", c.PostTyping)

	// Reactions
	rg.POST("/chats/:id/messages/:mid/reactions", c.PostReact)
	rg.DELETE("/chats/:id/messages/:mid/reactions", c.DeleteReact)

	// Chat actions
	rg.POST("/chats/:id/accept", c.PostAcceptChat)
	rg.POST("/chats/:id/block", c.PostBlockChat)
}

// RegisterWS mounts GET /ws without JWT middleware (token parsed inside).
func RegisterWS(rg *gin.RouterGroup, c *Controller) {
	rg.GET("/ws", c.GetWS)
}
