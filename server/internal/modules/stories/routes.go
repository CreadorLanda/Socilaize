package stories

import "github.com/gin-gonic/gin"

func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/stories")
	g.POST("", c.PostCreate)
	g.GET("", c.GetFeed)
	g.GET("/:id", c.GetOne)
	g.POST("/:id/view", c.PostView)
	g.POST("/:id/react", c.PostReact)
	g.DELETE("/:id", c.Delete)
}
