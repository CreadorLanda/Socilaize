package whatsapp

import "github.com/gin-gonic/gin"

// Register wires the /api/bridges/whatsapp endpoints. The caller's group
// must already have middleware.Auth applied — only signed-in users can
// touch their own bridge.
func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/bridges/whatsapp")
	g.POST("/link", c.PostLink)
	g.GET("/status", c.GetStatus)
	g.DELETE("/link", c.DeleteLink)
}
