package auth

import "github.com/gin-gonic/gin"

// Register wires the auth endpoints onto the /api router group.
func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/auth")
	g.POST("/start", c.PostStart)
	g.POST("/verify", c.PostVerify)
	g.POST("/refresh", c.PostRefresh)
}
