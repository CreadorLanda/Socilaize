package media

import "github.com/gin-gonic/gin"

// Register mounts authenticated media routes (upload / meta / delete).
func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/media")
	g.POST("/upload", c.PostUpload)
	g.GET("/:id", c.GetMeta)
	g.GET("/:id/file", c.GetFile)
	g.DELETE("/:id", c.Delete)
}

// RegisterPublic is gone on purpose.
//
// Byte streaming used to be unauthenticated because <Image> cannot attach
// an Authorization header — which meant anyone holding a media UUID could
// read the file. The client now fetches through its own cache layer with
// fetch(), so the endpoint is authenticated like everything else, and the
// bytes are encrypted end-to-end on top of that.
