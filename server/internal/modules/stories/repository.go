package stories

import (
	"context"
	"time"

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

type row struct {
	ID           uuid.UUID
	AuthorID     uuid.UUID
	Kind         string
	Caption      string
	MediaURL     *string
	Accent       string
	Visibility   string
	IsAnonymous  bool
	DurationSec  int
	ExpiresAt    time.Time
	CreatedAt    time.Time
	AuthorName   string
	AuthorUser   string
	AuthorAvatar string
	Viewers      int
	IsViewed     bool
}

func (r *Repository) Insert(
	ctx context.Context,
	author uuid.UUID,
	kind Kind,
	caption, mediaURL, accent string,
	vis Visibility,
	anon bool,
	durationSec int,
	expires time.Time,
) (uuid.UUID, error) {
	var media *string
	if mediaURL != "" {
		media = &mediaURL
	}
	var id uuid.UUID
	err := r.db.QueryRow(ctx, `
		INSERT INTO stories (
			author_id, kind, caption, media_url, accent, visibility,
			is_anonymous, duration_sec, expires_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id
	`, author, string(kind), caption, media, accent, string(vis), anon, durationSec, expires).Scan(&id)
	return id, err
}

func (r *Repository) Get(ctx context.Context, id, viewer uuid.UUID) (row, error) {
	const q = `
		SELECT s.id, s.author_id, s.kind, s.caption, s.media_url, s.accent, s.visibility,
		       s.is_anonymous, s.duration_sec, s.expires_at, s.created_at,
		       COALESCE(u.display_name,''), COALESCE(u.username,''), COALESCE(u.avatar_uri,''),
		       (SELECT COUNT(*) FROM story_views v WHERE v.story_id = s.id),
		       EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.viewer_id = $2)
		FROM stories s
		JOIN users u ON u.id = s.author_id
		WHERE s.id = $1 AND s.expires_at > NOW()
	`
	var x row
	err := r.db.QueryRow(ctx, q, id, viewer).Scan(
		&x.ID, &x.AuthorID, &x.Kind, &x.Caption, &x.MediaURL, &x.Accent, &x.Visibility,
		&x.IsAnonymous, &x.DurationSec, &x.ExpiresAt, &x.CreatedAt,
		&x.AuthorName, &x.AuthorUser, &x.AuthorAvatar, &x.Viewers, &x.IsViewed,
	)
	return x, err
}

// Feed returns active stories visible to viewer (own + public + contacts heuristic:
// for v1 contacts/close ≈ all non-expired stories from others + own).
func (r *Repository) Feed(ctx context.Context, viewer uuid.UUID) ([]row, error) {
	const q = `
		SELECT s.id, s.author_id, s.kind, s.caption, s.media_url, s.accent, s.visibility,
		       s.is_anonymous, s.duration_sec, s.expires_at, s.created_at,
		       COALESCE(u.display_name,''), COALESCE(u.username,''), COALESCE(u.avatar_uri,''),
		       (SELECT COUNT(*) FROM story_views v WHERE v.story_id = s.id),
		       EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.viewer_id = $1)
		FROM stories s
		JOIN users u ON u.id = s.author_id
		WHERE s.expires_at > NOW()
		  AND (
		    s.author_id = $1
		    OR s.visibility = 'public'
		    OR s.visibility IN ('contacts', 'close')
		  )
		ORDER BY
		  CASE WHEN s.author_id = $1 THEN 0 ELSE 1 END,
		  s.created_at DESC
		LIMIT 100
	`
	rows, err := r.db.Query(ctx, q, viewer)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []row
	for rows.Next() {
		var x row
		if err := rows.Scan(
			&x.ID, &x.AuthorID, &x.Kind, &x.Caption, &x.MediaURL, &x.Accent, &x.Visibility,
			&x.IsAnonymous, &x.DurationSec, &x.ExpiresAt, &x.CreatedAt,
			&x.AuthorName, &x.AuthorUser, &x.AuthorAvatar, &x.Viewers, &x.IsViewed,
		); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

func (r *Repository) MarkViewed(ctx context.Context, storyID, viewer uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO story_views (story_id, viewer_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, storyID, viewer)
	return err
}

func (r *Repository) Delete(ctx context.Context, id, author uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM stories WHERE id = $1 AND author_id = $2
	`, id, author)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *Repository) React(ctx context.Context, storyID, userID uuid.UUID, emoji string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO story_reactions (story_id, user_id, emoji)
		VALUES ($1, $2, $3)
		ON CONFLICT (story_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = NOW()
	`, storyID, userID, emoji)
	return err
}
