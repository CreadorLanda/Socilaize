package users

import "github.com/gin-gonic/gin"

// Register wires /users routes. All endpoints here assume the calling
// group already has middleware.Auth applied — see server.Bootstrap.
func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/users")
	g.GET("/me", c.GetMe)
	g.PATCH("/me", c.PatchMe)
	g.GET("/availability", c.GetAvailability)
	g.GET("/search", c.GetSearch)
	g.GET("/by-username/:username", c.GetByUsername)
}
