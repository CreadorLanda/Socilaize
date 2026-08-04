package media

import (
	"context"
	"crypto/sha256"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Retention is the promise the product makes about user data, so it is
// verified against a real database rather than reasoned about.
func TestSweeperRetention(t *testing.T) {
	url := os.Getenv("TEST_POSTGRES_URL")
	if url == "" {
		t.Skip("TEST_POSTGRES_URL not set — skipping retention test")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	dir := t.TempDir()
	repo := NewRepository(pool)
	sweeper := NewSweeper(repo, dir, time.Hour)

	owner := seedUser(ctx, t, pool)
	other := seedUser(ctx, t, pool)

	// A blob nobody has fetched, with a deadline in the future: stays.
	keep := seedMedia(ctx, t, pool, repo, dir, owner)
	if err := repo.SetExpiry(ctx, keep, time.Now().Add(time.Hour), 1); err != nil {
		t.Fatal(err)
	}

	// Past its deadline: goes, even though nobody fetched it.
	expired := seedMedia(ctx, t, pool, repo, dir, owner)
	if err := repo.SetExpiry(ctx, expired, time.Now().Add(-time.Minute), 1); err != nil {
		t.Fatal(err)
	}

	// Everyone expected has fetched it: goes early, before the deadline.
	delivered := seedMedia(ctx, t, pool, repo, dir, owner)
	if err := repo.SetExpiry(ctx, delivered, time.Now().Add(time.Hour), 1); err != nil {
		t.Fatal(err)
	}
	if err := repo.MarkFetched(ctx, delivered, other); err != nil {
		t.Fatal(err)
	}

	// Backup enabled: exempt even though it is long past due.
	backed := seedMedia(ctx, t, pool, repo, dir, owner)
	if err := repo.SetExpiry(ctx, backed, time.Now().Add(-time.Hour), 1); err != nil {
		t.Fatal(err)
	}
	if err := repo.SetKeepForever(ctx, backed, true); err != nil {
		t.Fatal(err)
	}

	sweeper.sweep(ctx)

	cases := []struct {
		name   string
		id     uuid.UUID
		purged bool
	}{
		{"deadline in the future, not fetched", keep, false},
		{"past deadline", expired, true},
		{"all recipients fetched", delivered, true},
		{"backup enabled", backed, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var purgedAt *time.Time
			var path string
			if err := pool.QueryRow(ctx,
				`SELECT purged_at, storage_path FROM media_objects WHERE id = $1`, tc.id,
			).Scan(&purgedAt, &path); err != nil {
				t.Fatal(err)
			}
			gone := purgedAt != nil
			if gone != tc.purged {
				t.Fatalf("purged = %v, want %v", gone, tc.purged)
			}
			// The bytes must actually be off disk, not just flagged.
			_, statErr := os.Stat(filepath.Join(dir, filepath.FromSlash(path)))
			fileGone := os.IsNotExist(statErr)
			if fileGone != tc.purged {
				t.Fatalf("file removed = %v, want %v", fileGone, tc.purged)
			}
		})
	}

	// The row survives as a tombstone so history does not break.
	var rows int
	if err := pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM media_objects WHERE id = $1`, expired).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 1 {
		t.Fatalf("purged media row disappeared; want a tombstone")
	}
}

func seedUser(ctx context.Context, t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	// users stores a hash, never the number itself.
	phoneHash := sha256.Sum256([]byte(uuid.NewString()))
	if err := pool.QueryRow(ctx,
		`INSERT INTO users (phone_hash, username, display_name) VALUES ($1, $2, $3) RETURNING id`,
		phoneHash[:], "u"+uuid.NewString()[:8], "Test",
	).Scan(&id); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id)
	})
	return id
}

func seedMedia(
	ctx context.Context,
	t *testing.T,
	pool *pgxpool.Pool,
	repo *Repository,
	dir string,
	owner uuid.UUID,
) uuid.UUID {
	t.Helper()
	rel := filepath.ToSlash(filepath.Join(owner.String(), uuid.NewString()+".bin"))
	abs := filepath.Join(dir, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(abs), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(abs, []byte("bytes"), 0o640); err != nil {
		t.Fatal(err)
	}
	row, err := repo.Insert(ctx, owner, KindImage, "image/webp", 5, rel, "x.bin", nil, nil, nil)
	if err != nil {
		t.Fatalf("seed media: %v", err)
	}
	return row.ID
}
