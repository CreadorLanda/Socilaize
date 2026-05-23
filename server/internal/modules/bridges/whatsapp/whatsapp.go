// Package whatsapp is the Socialize API side of the WhatsApp bridge.
//
// It does NOT speak to WhatsApp directly. The actual whatsmeow session lives
// inside the mautrix-whatsapp sidecar (one worker process per linked user).
// This module is the thin façade the mobile client talks to: link, unlink,
// status, and routing the inbound/outbound message streams through Redis.
//
// Skeleton: handlers return 501 Not Implemented until backend/bridge-whatsapp
// wires the sidecar. See docs/tech/whatsapp-bridge.md.
package whatsapp

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Service struct {
	pg  *pgxpool.Pool
	rdb *redis.Client
}

func NewService(pg *pgxpool.Pool, rdb *redis.Client) *Service { return &Service{pg: pg, rdb: rdb} }

type Controller struct{ svc *Service }

func NewController(s *Service) *Controller { return &Controller{svc: s} }

// Register wires the /api/bridges/whatsapp endpoints.
func Register(rg *gin.RouterGroup, c *Controller) {
	g := rg.Group("/bridges/whatsapp")
	g.POST("/link", c.PostLink)
	g.DELETE("/link", c.DeleteLink)
	g.GET("/status", c.GetStatus)
}

func (c *Controller) PostLink(ctx *gin.Context) {
	// Issue: start a whatsmeow login on the sidecar and stream the QR back.
	ctx.JSON(http.StatusNotImplemented, gin.H{
		"error":  "not_implemented",
		"branch": "backend/bridge-whatsapp",
		"docs":   "docs/tech/whatsapp-bridge.md#linking-a-whatsapp-account",
	})
}

func (c *Controller) DeleteLink(ctx *gin.Context) {
	ctx.JSON(http.StatusNotImplemented, gin.H{
		"error":  "not_implemented",
		"branch": "backend/bridge-whatsapp",
	})
}

func (c *Controller) GetStatus(ctx *gin.Context) {
	ctx.JSON(http.StatusNotImplemented, gin.H{
		"error":  "not_implemented",
		"branch": "backend/bridge-whatsapp",
	})
}
