package users

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/CreadorLanda/Socilaize/server/internal/middleware"
)

type Controller struct {
	svc *Service
}

func NewController(svc *Service) *Controller {
	return &Controller{svc: svc}
}

func (c *Controller) GetMe(ctx *gin.Context) {
	u, err := c.svc.Me(ctx.Request.Context(), middleware.UserIDFrom(ctx))
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, u)
}

func (c *Controller) PatchMe(ctx *gin.Context) {
	var req PatchRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	u, err := c.svc.Patch(ctx.Request.Context(), middleware.UserIDFrom(ctx), req)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, u)
}

func (c *Controller) GetAvailability(ctx *gin.Context) {
	username := ctx.Query("username")
	if username == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "username_required"})
		return
	}
	res, err := c.svc.CheckAvailability(ctx.Request.Context(), middleware.UserIDFrom(ctx), username)
	// Validation failures still get a 200 — they're answering the question
	// "is this name usable", and the right answer is "no, it's invalid".
	if errors.Is(err, ErrUsernameInvalid) {
		ctx.JSON(http.StatusOK, res)
		return
	}
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, res)
}

func (c *Controller) GetSearch(ctx *gin.Context) {
	q := ctx.Query("q")
	if q == "" || len(q) < 2 {
		ctx.JSON(http.StatusOK, []User{})
		return
	}
	users, err := c.svc.Search(ctx.Request.Context(), middleware.UserIDFrom(ctx), q)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	if users == nil {
		users = []User{}
	}
	ctx.JSON(http.StatusOK, users)
}

func (c *Controller) GetByUsername(ctx *gin.Context) {
	u, err := c.svc.ByUsername(
		ctx.Request.Context(),
		middleware.UserIDFrom(ctx),
		ctx.Param("username"),
	)
	if err != nil {
		writeErr(ctx, err)
		return
	}
	ctx.JSON(http.StatusOK, u)
}

func writeErr(ctx *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrNotFound):
		ctx.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, ErrUsernameInvalid):
		ctx.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
	case errors.Is(err, ErrUsernameTaken):
		ctx.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
	}
}
