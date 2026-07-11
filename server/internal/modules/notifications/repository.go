package notifications

import (
	"context"
	"errors"
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

func (r *Repository) UpsertDevice(
	ctx context.Context,
	userID, deviceID uuid.UUID,
	platform Platform,
	token string,
) (Device, error) {
	const q = `
		INSERT INTO push_devices (user_id, device_id, platform, token)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, device_id) DO UPDATE
		SET token = EXCLUDED.token,
		    platform = EXCLUDED.platform,
		    updated_at = NOW()
		RETURNING id, user_id, device_id, platform, token, created_at, updated_at
	`
	var d Device
	var plat string
	err := r.db.QueryRow(ctx, q, userID, deviceID, string(platform), token).Scan(
		&d.ID, &d.UserID, &d.DeviceID, &plat, &d.Token, &d.CreatedAt, &d.UpdatedAt,
	)
	d.Platform = Platform(plat)
	return d, err
}

func (r *Repository) DeleteDevice(ctx context.Context, userID, deviceID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM push_devices WHERE user_id = $1 AND device_id = $2
	`, userID, deviceID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *Repository) DeleteByToken(ctx context.Context, userID uuid.UUID, token string) error {
	_, err := r.db.Exec(ctx, `
		DELETE FROM push_devices WHERE user_id = $1 AND token = $2
	`, userID, token)
	return err
}

func (r *Repository) ListTokens(ctx context.Context, userID uuid.UUID) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		SELECT token FROM push_devices WHERE user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *Repository) GetPrefs(ctx context.Context, userID uuid.UUID) (Prefs, error) {
	const q = `
		SELECT user_id, messages, groups, calls, stories
		FROM notification_prefs WHERE user_id = $1
	`
	var p Prefs
	err := r.db.QueryRow(ctx, q, userID).Scan(
		&p.UserID, &p.Messages, &p.Groups, &p.Calls, &p.Stories,
	)
	if err != nil {
		return Prefs{}, err
	}
	return p, nil
}

func (r *Repository) UpsertPrefs(ctx context.Context, p Prefs) (Prefs, error) {
	const q = `
		INSERT INTO notification_prefs (user_id, messages, groups, calls, stories, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (user_id) DO UPDATE
		SET messages = EXCLUDED.messages,
		    groups = EXCLUDED.groups,
		    calls = EXCLUDED.calls,
		    stories = EXCLUDED.stories,
		    updated_at = NOW()
		RETURNING user_id, messages, groups, calls, stories
	`
	var out Prefs
	err := r.db.QueryRow(ctx, q, p.UserID, p.Messages, p.Groups, p.Calls, p.Stories).Scan(
		&out.UserID, &out.Messages, &out.Groups, &out.Calls, &out.Stories,
	)
	return out, err
}

// EnsurePrefs returns prefs, creating defaults if missing.
func (r *Repository) EnsurePrefs(ctx context.Context, userID uuid.UUID) (Prefs, error) {
	p, err := r.GetPrefs(ctx, userID)
	if err == nil {
		return p, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return Prefs{}, err
	}
	return r.UpsertPrefs(ctx, Prefs{
		UserID:   userID,
		Messages: true,
		Groups:   true,
		Calls:    false,
		Stories:  true,
	})
}

var _ = time.Now
