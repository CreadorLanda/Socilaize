package blocks

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Blocked is one person you have blocked, with enough to show a row.
type Blocked struct {
	UserID      uuid.UUID `json:"user_id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarURI   string    `json:"avatar_uri,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type Repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) *Repo { return &Repo{db: db} }

func (r *Repo) Block(ctx context.Context, blocker, blocked uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, blocker, blocked)
	return err
}

func (r *Repo) Unblock(ctx context.Context, blocker, blocked uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`, blocker, blocked)
	return err
}

// Blocks reports whether `blocker` has blocked `blocked`.
//
// One direction only. Asking it the other way round is a different question
// with a different answer, and conflating the two is how the old chat-level
// status ended up stopping the blocker from writing too.
func (r *Repo) Blocks(ctx context.Context, blocker, blocked uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2)
	`, blocker, blocked).Scan(&exists)
	return exists, err
}

// EitherWay reports whether either has blocked the other.
//
// The right question for a shared one-to-one channel: a call or a direct
// message needs both sides willing, and it must not matter who pressed the
// button for the other one to be spared the ring.
func (r *Repo) EitherWay(ctx context.Context, a, b uuid.UUID) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM blocks
			WHERE (blocker_id = $1 AND blocked_id = $2)
			   OR (blocker_id = $2 AND blocked_id = $1)
		)
	`, a, b).Scan(&exists)
	return exists, err
}

func (r *Repo) List(ctx context.Context, blocker uuid.UUID) ([]Blocked, error) {
	rows, err := r.db.Query(ctx, `
		SELECT b.blocked_id, u.username, u.display_name,
		       COALESCE(u.avatar_uri, ''), b.created_at
		FROM blocks b
		JOIN users u ON u.id = b.blocked_id
		WHERE b.blocker_id = $1
		ORDER BY b.created_at DESC
	`, blocker)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Blocked{}
	for rows.Next() {
		var b Blocked
		if err := rows.Scan(&b.UserID, &b.Username, &b.DisplayName,
			&b.AvatarURI, &b.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}
