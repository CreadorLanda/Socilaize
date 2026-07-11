package media

import "github.com/gin-gonic/gin"

// Register mounts authenticated media routes (upload / meta / delete).
func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/media")
	g.POST("/upload", c.PostUpload)
	g.GET("/:id", c.GetMeta)
	g.DELETE("/:id", c.Delete)
}

// RegisterPublic mounts byte streaming. IDs are UUIDs (unguessable); the
// client <Image> component cannot attach Authorization headers, so files
// are reachable by id alone. Tighten with signed URLs later if needed.
func RegisterPublic(rg *gin.RouterGroup, c *Controller) {
	rg.GET("/media/:id/file", c.GetFile)
}
