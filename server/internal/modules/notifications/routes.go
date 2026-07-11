package notifications

import "github.com/gin-gonic/gin"

// Register mounts notification routes on a JWT-protected group.
func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/notifications")
	g.PUT("/devices", c.PutDevice)
	g.DELETE("/devices", c.DeleteDevice)
	g.GET("/prefs", c.GetPrefs)
	g.PATCH("/prefs", c.PatchPrefs)
	g.POST("/test", c.PostTest)
}
