package media

import (
	"context"

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

func (r *Repository) Insert(
	ctx context.Context,
	ownerID uuid.UUID,
	kind Kind,
	mime string,
	size int64,
	path string,
	name string,
	width, height, durationMs *int,
) (objectRow, error) {
	const q = `
		INSERT INTO media_objects (
			owner_id, kind, mime_type, size_bytes, width, height, duration_ms,
			original_name, storage_path
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, owner_id, kind, mime_type, size_bytes, width, height,
		          duration_ms, original_name, storage_path, created_at
	`
	var namePtr *string
	if name != "" {
		namePtr = &name
	}
	var row objectRow
	err := r.db.QueryRow(ctx, q,
		ownerID, string(kind), mime, size, width, height, durationMs, namePtr, path,
	).Scan(
		&row.ID, &row.OwnerID, &row.Kind, &row.MimeType, &row.SizeBytes,
		&row.Width, &row.Height, &row.DurationMs, &row.OriginalName,
		&row.StoragePath, &row.CreatedAt,
	)
	return row, err
}

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (objectRow, error) {
	const q = `
		SELECT id, owner_id, kind, mime_type, size_bytes, width, height,
		       duration_ms, original_name, storage_path, created_at
		FROM media_objects WHERE id = $1
	`
	var row objectRow
	err := r.db.QueryRow(ctx, q, id).Scan(
		&row.ID, &row.OwnerID, &row.Kind, &row.MimeType, &row.SizeBytes,
		&row.Width, &row.Height, &row.DurationMs, &row.OriginalName,
		&row.StoragePath, &row.CreatedAt,
	)
	return row, err
}

func (r *Repository) Delete(ctx context.Context, id, ownerID uuid.UUID) (objectRow, error) {
	const q = `
		DELETE FROM media_objects
		WHERE id = $1 AND owner_id = $2
		RETURNING id, owner_id, kind, mime_type, size_bytes, width, height,
		          duration_ms, original_name, storage_path, created_at
	`
	var row objectRow
	err := r.db.QueryRow(ctx, q, id, ownerID).Scan(
		&row.ID, &row.OwnerID, &row.Kind, &row.MimeType, &row.SizeBytes,
		&row.Width, &row.Height, &row.DurationMs, &row.OriginalName,
		&row.StoragePath, &row.CreatedAt,
	)
	if err != nil {
		return row, err
	}
	return row, nil
}

func IsNoRows(err error) bool {
	return err != nil && err == pgx.ErrNoRows
}
