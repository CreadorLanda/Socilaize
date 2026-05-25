package users

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const userColumns = `id, username, display_name,
	COALESCE(bio, '') AS bio,
	COALESCE(avatar_uri, '') AS avatar_uri,
	username_public, created_at`

func scanUser(row pgx.Row) (*User, error) {
	var u User
	if err := row.Scan(
		&u.ID, &u.Username, &u.DisplayName,
		&u.Bio, &u.AvatarURI,
		&u.UsernamePublic, &u.CreatedAt,
	); err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repository) ByID(ctx context.Context, id uuid.UUID) (*User, error) {
	return scanUser(r.db.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

func (r *Repository) ByUsername(ctx context.Context, username string) (*User, error) {
	return scanUser(r.db.QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE username = $1`, strings.ToLower(username)))
}

// IsUsernameTaken returns true if SOMEONE ELSE has that username. Passing
// the caller's own id excludes them so a no-op PATCH doesn't think the
// username is taken by itself.
func (r *Repository) IsUsernameTaken(ctx context.Context, username string, exceptUser uuid.UUID) (bool, error) {
	const q = `SELECT EXISTS (SELECT 1 FROM users WHERE username = $1 AND id <> $2)`
	var taken bool
	if err := r.db.QueryRow(ctx, q, strings.ToLower(username), exceptUser).Scan(&taken); err != nil {
		return false, err
	}
	return taken, nil
}

// Patch applies a partial update; only non-nil fields move. Returns the
// fresh user row after the update.
func (r *Repository) Patch(ctx context.Context, id uuid.UUID, p PatchRequest) (*User, error) {
	setters := []string{}
	args := []any{}
	add := func(col string, v any) {
		args = append(args, v)
		setters = append(setters, fmt.Sprintf("%s = $%d", col, len(args)))
	}
	if p.Username != nil {
		add("username", strings.ToLower(*p.Username))
	}
	if p.DisplayName != nil {
		add("display_name", *p.DisplayName)
	}
	if p.Bio != nil {
		add("bio", *p.Bio)
	}
	if p.AvatarURI != nil {
		add("avatar_uri", *p.AvatarURI)
	}
	if p.UsernamePublic != nil {
		add("username_public", *p.UsernamePublic)
	}
	if len(setters) == 0 {
		return r.ByID(ctx, id)
	}
	setters = append(setters, "updated_at = NOW()")
	args = append(args, id)
	q := fmt.Sprintf(
		`UPDATE users SET %s WHERE id = $%d RETURNING %s`,
		strings.Join(setters, ", "), len(args), userColumns,
	)
	return scanUser(r.db.QueryRow(ctx, q, args...))
}

// IsNoRows mirrors the helper in auth — keeps the pgx import out of callers.
func IsNoRows(err error) bool { return err != nil && errors.Is(err, pgx.ErrNoRows) }
