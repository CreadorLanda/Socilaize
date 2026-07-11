package stories

import (
	"time"

	"github.com/google/uuid"
)

type Kind string

const (
	KindImage Kind = "image"
	KindVideo Kind = "video"
	KindText  Kind = "text"
	KindAudio Kind = "audio"
)

type Visibility string

const (
	VisPublic   Visibility = "public"
	VisContacts Visibility = "contacts"
	VisClose    Visibility = "close"
)

type Story struct {
	ID           uuid.UUID  `json:"id"`
	AuthorID     uuid.UUID  `json:"author_id"`
	AuthorName   string     `json:"author_name,omitempty"`
	AuthorUser   string     `json:"author_username,omitempty"`
	AuthorAvatar string     `json:"author_avatar,omitempty"`
	Kind         Kind       `json:"kind"`
	Caption      string     `json:"caption"`
	MediaURL     string     `json:"media_url,omitempty"`
	Accent       string     `json:"accent"`
	Visibility   Visibility `json:"visibility"`
	IsAnonymous  bool       `json:"is_anonymous"`
	DurationSec  int        `json:"duration_sec"`
	ExpiresAt    time.Time  `json:"expires_at"`
	CreatedAt    time.Time  `json:"created_at"`
	Viewers      int        `json:"viewers"`
	IsViewed     bool       `json:"is_viewed"`
	IsOwn        bool       `json:"is_own"`
}

type CreateRequest struct {
	Kind        Kind       `json:"kind" binding:"required"`
	Caption     string     `json:"caption"`
	MediaURL    string     `json:"media_url"`
	Accent      string     `json:"accent"`
	Visibility  Visibility `json:"visibility"`
	IsAnonymous bool       `json:"is_anonymous"`
	DurationSec int        `json:"duration_sec"`
	// TTLHours defaults to 24.
	TTLHours int `json:"ttl_hours"`
}

type ReactRequest struct {
	Emoji string `json:"emoji" binding:"required"`
}
