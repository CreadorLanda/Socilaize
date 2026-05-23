// Package health exposes a tiny liveness endpoint used by load balancers
// and humans alike. Keeps zero dependencies on other modules.
package health

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Controller struct {
	pg  *pgxpool.Pool
	rdb *redis.Client
}

func New(pg *pgxpool.Pool, rdb *redis.Client) *Controller {
	return &Controller{pg: pg, rdb: rdb}
}

func (c *Controller) Register(rg *gin.RouterGroup) {
	rg.GET("/healthz", c.Healthz)
	rg.GET("/readyz", c.Readyz)
}

func (c *Controller) Healthz(ctx *gin.Context) {
	ctx.JSON(200, gin.H{"status": "ok"})
}

func (c *Controller) Readyz(ctx *gin.Context) {
	deadline, cancel := context.WithTimeout(ctx.Request.Context(), 3*time.Second)
	defer cancel()

	pg := "ok"
	if err := c.pg.Ping(deadline); err != nil {
		pg = err.Error()
	}
	rd := "ok"
	if err := c.rdb.Ping(deadline).Err(); err != nil {
		rd = err.Error()
	}

	code := 200
	if pg != "ok" || rd != "ok" {
		code = 503
	}
	ctx.JSON(code, gin.H{
		"postgres": pg,
		"redis":    rd,
	})
}
