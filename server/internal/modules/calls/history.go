package calls

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Call history.
//
// The log is written from the same place that hands out join tokens, because
// that is the only moment the server reliably hears about a call: it signs a
// token when someone starts one and again when someone answers. Anything the
// client reports afterwards — "I hung up" — may never arrive, so the end of a
// call is inferred rather than trusted.

// Outcome is what the log says happened to one person.
type Outcome string

const (
	// OutcomeAnswered — they joined.
	OutcomeAnswered Outcome = "answered"
	// OutcomeDeclined — they said no.
	OutcomeDeclined Outcome = "declined"
	// OutcomeMissed — the call ended and they never joined. Only knowable
	// once the call is over, which is why it is not a state anything writes
	// when ringing starts.
	OutcomeMissed Outcome = "missed"
	// OutcomeRinging — still running, still not joined. This is the one that
	// makes the log useful: the call is there to be joined.
	OutcomeRinging Outcome = "ringing"
)

// Entry is one row of the call log, from one person's point of view.
type Entry struct {
	ID         uuid.UUID  `json:"id"`
	ChatID     uuid.UUID  `json:"chat_id"`
	CallerID   uuid.UUID  `json:"caller_id"`
	CallerName string     `json:"caller_name"`
	Mode       string     `json:"mode"`
	StartedAt  time.Time  `json:"started_at"`
	EndedAt    *time.Time `json:"ended_at,omitempty"`
	// Running is a convenience for the client: a call with no end can still
	// be joined, and that is the difference between a log entry and a button.
	Running     bool    `json:"running"`
	Outcome     Outcome `json:"outcome"`
	Mine        bool    `json:"mine"`
	DurationSec int     `json:"duration_sec"`
	// Others in the call, for the group case where a name is not enough.
	Participants int `json:"participants"`
}

type HistoryRepo struct{ db *pgxpool.Pool }

func NewHistoryRepo(db *pgxpool.Pool) *HistoryRepo { return &HistoryRepo{db: db} }

// Start records a call and everyone it is ringing.
//
// Returns the existing call when one is already running in this chat: a
// second person pressing call on a group that is already talking should join
// it, not start a rival one.
// Returns created=false when it joined an existing call instead of starting
// one — the difference matters to anything that announces a new call.
func (r *HistoryRepo) Start(ctx context.Context, chatID, caller uuid.UUID, mode string, invitees []uuid.UUID) (uuid.UUID, bool, error) {
	var existing uuid.UUID
	err := r.db.QueryRow(ctx, `
		SELECT id FROM calls WHERE chat_id = $1 AND ended_at IS NULL
		ORDER BY started_at DESC LIMIT 1
	`, chatID).Scan(&existing)
	if err == nil {
		// Already running — the caller joins it instead.
		_ = r.Join(ctx, existing, caller)
		return existing, false, nil
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, false, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var id uuid.UUID
	if err := tx.QueryRow(ctx, `
		INSERT INTO calls (chat_id, caller_id, mode) VALUES ($1, $2, $3) RETURNING id
	`, chatID, caller, mode).Scan(&id); err != nil {
		return uuid.Nil, false, err
	}

	// The caller is in it from the start; everyone else is merely rung.
	if _, err := tx.Exec(ctx, `
		INSERT INTO call_participants (call_id, user_id, joined_at) VALUES ($1, $2, NOW())
	`, id, caller); err != nil {
		return uuid.Nil, false, err
	}
	for _, u := range invitees {
		if u == caller {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO call_participants (call_id, user_id) VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, id, u); err != nil {
			return uuid.Nil, false, err
		}
	}
	return id, true, tx.Commit(ctx)
}

// Join marks someone as having answered.
func (r *HistoryRepo) Join(ctx context.Context, callID, user uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO call_participants (call_id, user_id, joined_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (call_id, user_id)
		-- Only the first join counts. Rejoining after a dropped connection
		-- must not rewrite when they answered.
		DO UPDATE SET joined_at = COALESCE(call_participants.joined_at, NOW()),
		              declined  = FALSE
	`, callID, user)
	return err
}

// Running returns the call still going in this chat, if any.
func (r *HistoryRepo) Running(ctx context.Context, chatID uuid.UUID) (uuid.UUID, bool, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx, `
		SELECT id FROM calls WHERE chat_id = $1 AND ended_at IS NULL
		ORDER BY started_at DESC LIMIT 1
	`, chatID).Scan(&id)
	if err != nil {
		return uuid.Nil, false, nil
	}
	return id, true, nil
}

// Decline records an explicit refusal, which reads differently from silence.
func (r *HistoryRepo) Decline(ctx context.Context, callID, user uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE call_participants SET declined = TRUE
		WHERE call_id = $1 AND user_id = $2 AND joined_at IS NULL
	`, callID, user)
	return err
}

// End closes a call.
func (r *HistoryRepo) End(ctx context.Context, callID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE calls SET ended_at = NOW() WHERE id = $1 AND ended_at IS NULL`, callID)
	return err
}

// SweepStale closes calls nobody can still be in.
//
// The client is not the source of truth for the end of a call: whoever hangs
// up may close the app, lose signal, or have the phone die. Without this,
// a call whose participants all vanished stays "running" forever and the log
// offers a button that joins an empty room.
func (r *HistoryRepo) SweepStale(ctx context.Context, olderThan time.Duration) (int64, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE calls SET ended_at = NOW()
		WHERE ended_at IS NULL AND started_at < NOW() - $1::interval
	`, olderThan.String())
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// History is the log for one person.
func (r *HistoryRepo) History(ctx context.Context, user uuid.UUID, limit int) ([]Entry, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.chat_id, c.caller_id, COALESCE(u.display_name, ''),
		       c.mode, c.started_at, c.ended_at,
		       cp.joined_at IS NOT NULL AS joined,
		       cp.declined,
		       (SELECT count(*) FROM call_participants p WHERE p.call_id = c.id),
		       COALESCE(EXTRACT(EPOCH FROM (COALESCE(c.ended_at, NOW()) - cp.joined_at)), 0)
		FROM call_participants cp
		JOIN calls c ON c.id = cp.call_id
		LEFT JOIN users u ON u.id = c.caller_id
		WHERE cp.user_id = $1
		ORDER BY c.started_at DESC
		LIMIT $2
	`, user, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Entry{}
	for rows.Next() {
		var e Entry
		var joined, declined bool
		var dur float64
		if err := rows.Scan(&e.ID, &e.ChatID, &e.CallerID, &e.CallerName,
			&e.Mode, &e.StartedAt, &e.EndedAt, &joined, &declined,
			&e.Participants, &dur); err != nil {
			return nil, err
		}
		e.Mine = e.CallerID == user
		e.Running = e.EndedAt == nil
		e.DurationSec = int(dur)
		switch {
		case joined:
			e.Outcome = OutcomeAnswered
		case declined:
			e.Outcome = OutcomeDeclined
		case e.Running:
			// Still ringing, still joinable. Reporting this as "missed" would
			// hide the one call the log could actually help with.
			e.Outcome = OutcomeRinging
			e.DurationSec = 0
		default:
			e.Outcome = OutcomeMissed
			e.DurationSec = 0
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// Sweeper closes calls that nobody can still be in.
//
// Start/Stop rather than Run(ctx), to match the media and disappearing-message
// sweepers: one shape for background workers is one thing to remember.
type Sweeper struct {
	repo   *HistoryRepo
	every  time.Duration
	maxAge time.Duration
	cancel context.CancelFunc
}

func NewSweeper(repo *HistoryRepo, every, maxAge time.Duration) *Sweeper {
	if every <= 0 {
		every = 10 * time.Minute
	}
	if maxAge <= 0 {
		maxAge = 4 * time.Hour
	}
	return &Sweeper{repo: repo, every: every, maxAge: maxAge}
}

func (s *Sweeper) Start() {
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	go func() {
		// One pass at boot: a restart mid-call would otherwise leave it
		// "running" until the first tick.
		s.sweep(ctx)
		t := time.NewTicker(s.every)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				s.sweep(ctx)
			}
		}
	}()
}

func (s *Sweeper) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
}

func (s *Sweeper) sweep(ctx context.Context) {
	if s.repo == nil {
		return
	}
	_, _ = s.repo.SweepStale(ctx, s.maxAge)
}
