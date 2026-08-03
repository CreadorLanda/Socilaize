package stickers

import "github.com/gin-gonic/gin"

func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/stickers")
	g.POST("/packs", c.PostPack)
	g.GET("/packs", c.GetPacks)
	g.GET("/packs/:id", c.GetPack)
	g.DELETE("/packs/:id", c.DeletePack)
	// Saved stickers: one at a time, exempt from the pack minimum.
	g.POST("/favorites", c.PostFavorite)
	g.DELETE("/:stickerId", c.DeleteSticker)
}
