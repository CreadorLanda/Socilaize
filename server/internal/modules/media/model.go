package media

import (
	"time"

	"github.com/google/uuid"
)

type Kind string

const (
	KindImage    Kind = "image"
	KindVideo    Kind = "video"
	KindAudio    Kind = "audio"
	KindDocument Kind = "document"
	KindOther    Kind = "other"
)

// Object is a stored media blob owned by a user.
type Object struct {
	ID           uuid.UUID `json:"id"`
	OwnerID      uuid.UUID `json:"owner_id"`
	Kind         Kind      `json:"kind"`
	MimeType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	Width        *int      `json:"width,omitempty"`
	Height       *int      `json:"height,omitempty"`
	DurationMs   *int      `json:"duration_ms,omitempty"`
	OriginalName string    `json:"original_name,omitempty"`
	// URL is the path clients use to fetch the bytes (same-origin API).
	URL       string    `json:"url"`
	CreatedAt time.Time `json:"created_at"`
}

type objectRow struct {
	ID           uuid.UUID
	OwnerID      uuid.UUID
	Kind         string
	MimeType     string
	SizeBytes    int64
	Width        *int
	Height       *int
	DurationMs   *int
	OriginalName *string
	StoragePath  string
	CreatedAt    time.Time
}
