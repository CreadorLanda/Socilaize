package stories

import (
	"time"

	"github.com/google/uuid"
)

type Kind string

const (
	KindImage    Kind = "image"
	KindVideo    Kind = "video"
	KindText     Kind = "text"
	KindAudio    Kind = "audio"
	KindPoll     Kind = "poll"
	KindQuestion Kind = "question"
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
	// Comment policy, chosen at publish time.
	AllowComments         bool      `json:"allow_comments"`
	AllowAnonymousReplies bool      `json:"allow_anonymous_replies"`
	DurationSec           int       `json:"duration_sec"`
	ExpiresAt             time.Time `json:"expires_at"`
	CreatedAt             time.Time `json:"created_at"`
	Viewers               int       `json:"viewers"`
	IsViewed              bool      `json:"is_viewed"`
	IsOwn                 bool      `json:"is_own"`
}

type CreateRequest struct {
	Kind        Kind       `json:"kind" binding:"required"`
	Caption     string     `json:"caption"`
	MediaURL    string     `json:"media_url"`
	Accent      string     `json:"accent"`
	Visibility  Visibility `json:"visibility"`
	IsAnonymous bool       `json:"is_anonymous"`
	// Pointers so an omitted field keeps the default rather than meaning
	// false — a client that does not know about these must not switch
	// comments off for every story it publishes.
	AllowComments         *bool `json:"allow_comments"`
	AllowAnonymousReplies *bool `json:"allow_anonymous_replies"`
	DurationSec           int   `json:"duration_sec"`
	// TTLHours is clamped to [StoryTTLMinHours, StoryTTLMaxHours]; 0 means default.
	TTLHours int `json:"ttl_hours"`
}

type ReactRequest struct {
	Emoji string `json:"emoji" binding:"required"`
}

// Viewer is one row of the "seen by" list. Only the story's author can read
// these: who watched is as private as what they watched.
type Viewer struct {
	UserID      uuid.UUID `json:"user_id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name,omitempty"`
	AvatarURI   string    `json:"avatar_uri,omitempty"`
	ViewedAt    time.Time `json:"viewed_at"`
	// Empty when the viewer left no reaction.
	Emoji string `json:"emoji,omitempty"`
}

// How long a story may be kept alive, in hours.
//
// Exported so the bound has one definition: the client offers these choices
// and the server enforces them, and a mismatch shows up as a story quietly
// expiring earlier than the author was told it would.
const (
	StoryTTLMinHours     = 1
	StoryTTLDefaultHours = 24
	StoryTTLMaxHours     = 72
)
