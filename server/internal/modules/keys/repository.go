package keys

import (
	"context"
	"errors"

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

// OneTimePreKeyRow is the persistence-level shape, with raw bytes already
// decoded from the wire-format base64.
type OneTimePreKeyRow struct {
	KeyID     int
	PublicKey []byte
}

func (r *Repository) UpsertIdentity(ctx context.Context, userID, deviceID uuid.UUID, pub []byte) error {
	const q = `
		INSERT INTO identity_keys (user_id, device_id, public_key)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, device_id) DO UPDATE
		   SET public_key = EXCLUDED.public_key, updated_at = NOW()
	`
	_, err := r.db.Exec(ctx, q, userID, deviceID, pub)
	return err
}

func (r *Repository) UpsertSignedPreKey(ctx context.Context, userID, deviceID uuid.UUID, keyID int, pub, sig []byte) error {
	const q = `
		INSERT INTO signed_pre_keys (user_id, device_id, key_id, public_key, signature)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (user_id, device_id, key_id) DO UPDATE
		   SET public_key = EXCLUDED.public_key, signature = EXCLUDED.signature
	`
	_, err := r.db.Exec(ctx, q, userID, deviceID, keyID, pub, sig)
	return err
}

// InsertOneTimeKeys adds a batch of OTKs in one transaction, ignoring any
// that collide on (user, device, key_id). Returns the total remaining
// count so the caller can include it in the response.
func (r *Repository) InsertOneTimeKeys(ctx context.Context, userID, deviceID uuid.UUID, rows []OneTimePreKeyRow) (int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // best-effort on commit-path failure

	for _, k := range rows {
		if _, err := tx.Exec(ctx, `
			INSERT INTO one_time_pre_keys (user_id, device_id, key_id, public_key)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (user_id, device_id, key_id) DO NOTHING
		`, userID, deviceID, k.KeyID, k.PublicKey); err != nil {
			return 0, err
		}
	}
	var n int
	if err := tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM one_time_pre_keys WHERE user_id=$1 AND device_id=$2`,
		userID, deviceID,
	).Scan(&n); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return n, nil
}

func (r *Repository) CountOneTime(ctx context.Context, userID, deviceID uuid.UUID) (int, error) {
	var n int
	err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM one_time_pre_keys WHERE user_id=$1 AND device_id=$2`,
		userID, deviceID,
	).Scan(&n)
	return n, err
}

// BundleRow is the joined bundle payload, in raw bytes. The service wraps
// it for the wire. HasOTK = false means the OTK pool was empty and the
// recipient must fall back to a signed-pre-key-only session.
type BundleRow struct {
	UserID, DeviceID uuid.UUID
	Identity         []byte
	SignedKeyID      int
	SignedPub        []byte
	SignedSig        []byte
	HasOTK           bool
	OTKID            int
	OTKPub           []byte
}

// FetchBundle picks the recipient's most-recently-seen device that has a
// published identity, returns the latest signed pre-key, and consumes one
// OTK atomically (DELETE … RETURNING inside a transaction). FOR UPDATE
// SKIP LOCKED lets concurrent fetchers each grab a distinct OTK instead
// of serialising.
func (r *Repository) FetchBundle(ctx context.Context, userID uuid.UUID) (*BundleRow, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var row BundleRow
	row.UserID = userID

	if err := tx.QueryRow(ctx, `
		SELECT ik.device_id, ik.public_key
		FROM identity_keys ik
		JOIN devices d ON d.id = ik.device_id
		WHERE ik.user_id = $1
		ORDER BY d.last_seen_at DESC
		LIMIT 1
	`, userID).Scan(&row.DeviceID, &row.Identity); err != nil {
		return nil, err
	}

	if err := tx.QueryRow(ctx, `
		SELECT key_id, public_key, signature
		FROM signed_pre_keys
		WHERE user_id = $1 AND device_id = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, row.DeviceID).Scan(&row.SignedKeyID, &row.SignedPub, &row.SignedSig); err != nil {
		return nil, err
	}

	err = tx.QueryRow(ctx, `
		DELETE FROM one_time_pre_keys
		WHERE id = (
			SELECT id FROM one_time_pre_keys
			WHERE user_id = $1 AND device_id = $2
			ORDER BY id ASC
			LIMIT 1
			FOR UPDATE SKIP LOCKED
		)
		RETURNING key_id, public_key
	`, userID, row.DeviceID).Scan(&row.OTKID, &row.OTKPub)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		row.HasOTK = false
	case err != nil:
		return nil, err
	default:
		row.HasOTK = true
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &row, nil
}

// IsNoRows mirrors the helper in other modules — keeps pgx out of callers.
func IsNoRows(err error) bool { return err != nil && errors.Is(err, pgx.ErrNoRows) }
