package lives

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Live is one broadcast.
type Live struct {
	ID uuid.UUID `json:"id"`
	// Exactly one of these is set — where the broadcast lives and who its
	// audience is.
	ChannelID *uuid.UUID `json:"channel_id,omitempty"`
	ChatID    *uuid.UUID `json:"chat_id,omitempty"`
	HostID    uuid.UUID  `json:"host_id"`
	HostName  string     `json:"host_name"`
	Title     string     `json:"title"`
	StartedAt time.Time  `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at,omitempty"`
	// Viewers is the audience right now, excluding the host. Once the
	// broadcast ends this is zero and PeakViewers is what is left.
	Viewers     int `json:"viewers"`
	PeakViewers int `json:"peak_viewers"`
}

// Running reports whether it is still on.
func (l Live) Running() bool { return l.EndedAt == nil }

type StartInput struct {
	ChannelID *uuid.UUID
	ChatID    *uuid.UUID
	Title     string
}

type Repo struct{ db *pgxpool.Pool }

func NewRepo(db *pgxpool.Pool) *Repo { return &Repo{db: db} }

const liveColumns = `
	l.id, l.channel_id, l.chat_id, l.host_id, COALESCE(u.display_name, ''),
	l.title, l.started_at, l.ended_at, l.peak_viewers,
	(SELECT count(*) FROM live_viewers v WHERE v.live_id = l.id AND v.left_at IS NULL)
`

func scanLive(row pgx.Row) (Live, error) {
	var l Live
	err := row.Scan(&l.ID, &l.ChannelID, &l.ChatID, &l.HostID, &l.HostName,
		&l.Title, &l.StartedAt, &l.EndedAt, &l.PeakViewers, &l.Viewers)
	return l, err
}

// Start opens a broadcast.
//
// Refuses when one is already running in the same place. The unique partial
// indexes make that the database's answer rather than a check-then-insert,
// which two people pressing "go live" at the same moment would both pass.
func (r *Repo) Start(ctx context.Context, in StartInput, host uuid.UUID) (Live, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx, `
		INSERT INTO lives (channel_id, chat_id, host_id, title)
		VALUES ($1, $2, $3, $4) RETURNING id
	`, in.ChannelID, in.ChatID, host, in.Title).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			return Live{}, ErrAlreadyLive
		}
		return Live{}, err
	}
	return r.Get(ctx, id)
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (Live, error) {
	return scanLive(r.db.QueryRow(ctx, `
		SELECT `+liveColumns+`
		FROM lives l LEFT JOIN users u ON u.id = l.host_id
		WHERE l.id = $1
	`, id))
}

// RunningFor lists the broadcasts this user may watch right now.
//
// A channel's live is visible to its followers, and to anyone at all when the
// channel is public — that is what public means. A group's live is visible to
// the group.
func (r *Repo) RunningFor(ctx context.Context, userID uuid.UUID) ([]Live, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+liveColumns+`
		FROM lives l
		LEFT JOIN users u ON u.id = l.host_id
		LEFT JOIN channels c ON c.id = l.channel_id
		WHERE l.ended_at IS NULL
		  AND (
		    (l.channel_id IS NOT NULL AND (
		        c.visibility = 'public'
		        OR EXISTS (SELECT 1 FROM channel_members m
		                   WHERE m.channel_id = l.channel_id AND m.user_id = $1)
		    ))
		    OR
		    (l.chat_id IS NOT NULL AND EXISTS (
		        SELECT 1 FROM chat_participants p
		        WHERE p.chat_id = l.chat_id AND p.user_id = $1))
		  )
		ORDER BY l.started_at DESC
		LIMIT 50
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Live{}
	for rows.Next() {
		l, err := scanLive(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// Watch adds someone to the audience and returns the new count.
//
// Rejoining clears left_at rather than inserting again: someone whose
// connection dropped and came back is one viewer, not two, and a counter that
// only goes up is a counter nobody can trust.
func (r *Repo) Watch(ctx context.Context, liveID, userID uuid.UUID) (int, error) {
	if _, err := r.db.Exec(ctx, `
		INSERT INTO live_viewers (live_id, user_id) VALUES ($1, $2)
		ON CONFLICT (live_id, user_id)
		DO UPDATE SET left_at = NULL, joined_at = COALESCE(live_viewers.joined_at, NOW())
	`, liveID, userID); err != nil {
		return 0, err
	}
	n, err := r.ViewerCount(ctx, liveID)
	if err != nil {
		return 0, err
	}
	// The peak is the number worth keeping: the live count vanishes with the
	// broadcast, and "42 people watched" is what remains of it.
	_, _ = r.db.Exec(ctx,
		`UPDATE lives SET peak_viewers = $2 WHERE id = $1 AND peak_viewers < $2`, liveID, n)
	return n, nil
}

// Unwatch takes someone out and returns the new count.
func (r *Repo) Unwatch(ctx context.Context, liveID, userID uuid.UUID) (int, error) {
	if _, err := r.db.Exec(ctx, `
		UPDATE live_viewers SET left_at = NOW()
		WHERE live_id = $1 AND user_id = $2 AND left_at IS NULL
	`, liveID, userID); err != nil {
		return 0, err
	}
	return r.ViewerCount(ctx, liveID)
}

func (r *Repo) ViewerCount(ctx context.Context, liveID uuid.UUID) (int, error) {
	var n int
	err := r.db.QueryRow(ctx,
		`SELECT count(*) FROM live_viewers WHERE live_id = $1 AND left_at IS NULL`,
		liveID).Scan(&n)
	return n, err
}

// Watching is who has the broadcast open, for telling them the count changed.
func (r *Repo) Watching(ctx context.Context, liveID uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx,
		`SELECT user_id FROM live_viewers WHERE live_id = $1 AND left_at IS NULL`, liveID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []uuid.UUID{}
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// End closes a broadcast and empties its audience.
//
// The viewers are marked as gone in the same statement, or a live that ended
// would keep reporting the people who were watching when it did.
func (r *Repo) End(ctx context.Context, liveID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx,
		`UPDATE lives SET ended_at = NOW() WHERE id = $1 AND ended_at IS NULL`, liveID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE live_viewers SET left_at = NOW() WHERE live_id = $1 AND left_at IS NULL`,
		liveID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// SweepStale closes broadcasts nobody can still be in.
//
// The host is not a reliable reporter of the end: their phone may die, lose
// signal, or be closed mid-sentence. Without this a dead broadcast stays live
// forever and the audience is offered a room with nothing in it — the same
// fault calls had, for the same reason.
func (r *Repo) SweepStale(ctx context.Context, olderThan time.Duration) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE lives SET ended_at = NOW()
		WHERE ended_at IS NULL AND started_at < NOW() - $1::interval
	`, olderThan.String())
	if err != nil {
		return 0, err
	}
	if tag.RowsAffected() > 0 {
		_, _ = r.db.Exec(ctx, `
			UPDATE live_viewers v SET left_at = NOW()
			FROM lives l
			WHERE v.live_id = l.id AND v.left_at IS NULL AND l.ended_at IS NOT NULL
		`)
	}
	return tag.RowsAffected(), nil
}

func isUniqueViolation(err error) bool {
	var pgErr interface{ SQLState() string }
	return errors.As(err, &pgErr) && pgErr.SQLState() == "23505"
}
