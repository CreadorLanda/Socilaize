package groups

import "github.com/gin-gonic/gin"

// Register mounts group routes on a JWT-protected group.
func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/groups")
	g.POST("", c.PostCreate)
	g.GET("", c.GetList)
	g.GET("/:id", c.GetOne)
	g.PATCH("/:id", c.Patch)
	g.POST("/:id/members", c.PostMembers)
	g.DELETE("/:id/members/:userId", c.DeleteMember)
	g.PATCH("/:id/members/:userId", c.PatchMemberRole)
	g.POST("/:id/leave", c.PostLeave)
}
