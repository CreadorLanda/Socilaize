package channels

import "github.com/gin-gonic/gin"

func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/channels")
	g.POST("", c.PostCreate)
	g.GET("", c.GetList)
	g.GET("/handle-available", c.GetHandleAvailable)
	g.GET("/:id", c.GetOne)
	g.PATCH("/:id", c.Patch)
	g.POST("/:id/follow", c.PostFollow)
	g.DELETE("/:id/follow", c.DeleteFollow)
	g.GET("/:id/posts", c.GetPosts)
	g.POST("/:id/posts", c.PostPost)

	// Post-level actions (nested under /channels/posts to avoid route clash)
	p := rg.Group("/channel-posts")
	p.POST("/:postId/react", c.PostReact)
	p.DELETE("/:postId/react", c.DeleteReact)
	p.GET("/:postId/comments", c.GetComments)
	p.POST("/:postId/comments", c.PostComment)
}
