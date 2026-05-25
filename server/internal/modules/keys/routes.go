package keys

import "github.com/gin-gonic/gin"

// Register wires /users/.../keys routes. All endpoints require auth — the
// caller's group must already have middleware.Auth applied.
func Register(rg *gin.RouterGroup, c *Controller) {
	rg.PUT("/users/me/keys", c.PutKeys)
	rg.GET("/users/me/keys/count", c.GetMyCount)
	rg.GET("/users/by-username/:username/keys", c.GetBundle)
}
