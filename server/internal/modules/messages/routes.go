package messages

import "github.com/gin-gonic/gin"

// Register wires the messaging endpoints onto a protected router group
// (one that already has middleware.Auth applied).
func Register(rg *gin.RouterGroup, c *Controller) {
	// Session init — E2EE key exchange.
	rg.POST("/sessions/init", c.PostSessionInit)

	// Chats
	rg.POST("/chats", c.PostChat)
	rg.GET("/chats", c.GetChats)

	// Messages within a chat
	rg.POST("/chats/:id/messages", c.PostMessage)
	rg.GET("/chats/:id/messages", c.GetMessages)

	// Chat actions
	rg.POST("/chats/:id/accept", c.PostAcceptChat)
	rg.POST("/chats/:id/block", c.PostBlockChat)
}
