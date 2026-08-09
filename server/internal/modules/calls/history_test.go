package calls

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/CreadorLanda/Socilaize/server/internal/platform/postgres"
)

func historyDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_POSTGRES_URL")
	if url == "" {
		t.Skip("TEST_POSTGRES_URL not set — skipping integration test")
	}
	pool, err := postgres.Open(context.Background(), url)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func mkUser(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	name := "call_" + uuid.NewString()[:8]
	if err := pool.QueryRow(context.Background(), `
		INSERT INTO users (phone_hash, username, display_name)
		VALUES (gen_random_bytes(32), $1, $1) RETURNING id
	`, name).Scan(&id); err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() { pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id) })
	return id
}

func mkChat(t *testing.T, pool *pgxpool.Pool, members ...uuid.UUID) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	var id uuid.UUID
	if err := pool.QueryRow(ctx, `
		INSERT INTO chats (type, created_by, status) VALUES ('group', $1, 'active') RETURNING id
	`, members[0]).Scan(&id); err != nil {
		t.Fatalf("create chat: %v", err)
	}
	for _, m := range members {
		if _, err := pool.Exec(ctx,
			`INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2)`, id, m); err != nil {
			t.Fatalf("add participant: %v", err)
		}
	}
	t.Cleanup(func() { pool.Exec(ctx, `DELETE FROM chats WHERE id = $1`, id) })
	return id
}

func find(t *testing.T, list []Entry, callID uuid.UUID) Entry {
	t.Helper()
	for _, e := range list {
		if e.ID == callID {
			return e
		}
	}
	t.Fatalf("call %s missing from the log", callID)
	return Entry{}
}

// TestRunningCallIsJoinable is the point of the whole feature.
//
// You miss the ring, open the app, and the call is still going. Reporting it
// as "missed" would hide the one call the log could actually help with — and
// "missed" is not even knowable yet, because nobody can know it was missed
// until the call is over.
func TestRunningCallIsJoinable(t *testing.T) {
	pool := historyDB(t)
	ctx := context.Background()
	repo := NewHistoryRepo(pool)

	alice, bob := mkUser(t, pool), mkUser(t, pool)
	chat := mkChat(t, pool, alice, bob)

	callID, err := repo.Start(ctx, chat, alice, "voice", []uuid.UUID{alice, bob})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	log, err := repo.History(ctx, bob, 10)
	if err != nil {
		t.Fatalf("History: %v", err)
	}
	e := find(t, log, callID)
	if e.Outcome != OutcomeRinging {
		t.Fatalf("outcome = %q, want %q — a live call must not read as missed", e.Outcome, OutcomeRinging)
	}
	if !e.Running {
		t.Fatal("a call with no end is still running")
	}

	// And it is joinable: the log entry is a button, not a record.
	id, running, err := repo.Running(ctx, chat)
	if err != nil || !running || id != callID {
		t.Fatalf("Running = %s,%v,%v; want the live call", id, running, err)
	}
}

// TestMissedOnlyAfterTheCallEnds: the outcome flips once, at the end.
func TestMissedOnlyAfterTheCallEnds(t *testing.T) {
	pool := historyDB(t)
	ctx := context.Background()
	repo := NewHistoryRepo(pool)

	alice, bob := mkUser(t, pool), mkUser(t, pool)
	chat := mkChat(t, pool, alice, bob)
	callID, err := repo.Start(ctx, chat, alice, "voice", []uuid.UUID{alice, bob})
	if err != nil {
		t.Fatalf("Start: %v", err)
	}

	if err := repo.End(ctx, callID); err != nil {
		t.Fatalf("End: %v", err)
	}

	e := find(t, mustHistory(t, repo, bob), callID)
	if e.Outcome != OutcomeMissed {
		t.Fatalf("outcome = %q, want %q", e.Outcome, OutcomeMissed)
	}
	if e.Running {
		t.Fatal("an ended call still reads as running")
	}

	// The caller's own view of the same call is not "missed" — they were in it.
	mine := find(t, mustHistory(t, repo, alice), callID)
	if mine.Outcome != OutcomeAnswered || !mine.Mine {
		t.Fatalf("caller's view: outcome=%q mine=%v, want answered/true", mine.Outcome, mine.Mine)
	}
}

// TestAnsweringIsRecordedOnce: a dropped connection and a rejoin must not
// rewrite when someone answered, or the duration grows backwards.
func TestAnsweringIsRecordedOnce(t *testing.T) {
	pool := historyDB(t)
	ctx := context.Background()
	repo := NewHistoryRepo(pool)

	alice, bob := mkUser(t, pool), mkUser(t, pool)
	chat := mkChat(t, pool, alice, bob)
	callID, _ := repo.Start(ctx, chat, alice, "video", []uuid.UUID{alice, bob})

	if err := repo.Join(ctx, callID, bob); err != nil {
		t.Fatalf("Join: %v", err)
	}
	var first time.Time
	if err := pool.QueryRow(ctx,
		`SELECT joined_at FROM call_participants WHERE call_id=$1 AND user_id=$2`,
		callID, bob).Scan(&first); err != nil {
		t.Fatalf("read joined_at: %v", err)
	}

	if err := repo.Join(ctx, callID, bob); err != nil {
		t.Fatalf("re-Join: %v", err)
	}
	var second time.Time
	_ = pool.QueryRow(ctx,
		`SELECT joined_at FROM call_participants WHERE call_id=$1 AND user_id=$2`,
		callID, bob).Scan(&second)
	if !first.Equal(second) {
		t.Fatal("rejoining rewrote when they answered")
	}
}

// TestSecondCallerJoinsInsteadOfStartingARival: in a group, someone pressing
// call while a call is already happening should end up in that call.
func TestSecondCallerJoinsInsteadOfStartingARival(t *testing.T) {
	pool := historyDB(t)
	ctx := context.Background()
	repo := NewHistoryRepo(pool)

	alice, bob, carol := mkUser(t, pool), mkUser(t, pool), mkUser(t, pool)
	chat := mkChat(t, pool, alice, bob, carol)

	first, _ := repo.Start(ctx, chat, alice, "voice", []uuid.UUID{alice, bob, carol})
	second, err := repo.Start(ctx, chat, bob, "voice", []uuid.UUID{alice, bob, carol})
	if err != nil {
		t.Fatalf("second Start: %v", err)
	}
	if first != second {
		t.Fatalf("two rival calls in one chat: %s and %s", first, second)
	}

	e := find(t, mustHistory(t, repo, bob), first)
	if e.Outcome != OutcomeAnswered {
		t.Fatalf("the second caller reads as %q, want answered", e.Outcome)
	}
}

// TestSweepClosesAbandonedCalls: the client cannot be trusted to report the
// end — whoever hangs up may close the app or lose signal. Without a sweep, a
// dead call stays "running" and the log offers to join an empty room.
func TestSweepClosesAbandonedCalls(t *testing.T) {
	pool := historyDB(t)
	ctx := context.Background()
	repo := NewHistoryRepo(pool)

	alice := mkUser(t, pool)
	chat := mkChat(t, pool, alice)
	callID, _ := repo.Start(ctx, chat, alice, "voice", []uuid.UUID{alice})

	if _, err := pool.Exec(ctx,
		`UPDATE calls SET started_at = NOW() - INTERVAL '5 hours' WHERE id = $1`, callID); err != nil {
		t.Fatalf("age the call: %v", err)
	}

	n, err := repo.SweepStale(ctx, 4*time.Hour)
	if err != nil {
		t.Fatalf("SweepStale: %v", err)
	}
	if n == 0 {
		t.Fatal("the sweep closed nothing")
	}
	if _, running, _ := repo.Running(ctx, chat); running {
		t.Fatal("an abandoned call is still offered as joinable")
	}
}

func mustHistory(t *testing.T, repo *HistoryRepo, user uuid.UUID) []Entry {
	t.Helper()
	list, err := repo.History(context.Background(), user, 20)
	if err != nil {
		t.Fatalf("History: %v", err)
	}
	return list
}
