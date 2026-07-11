package notifications

import (
	"time"

	"github.com/google/uuid"
)

type Platform string

const (
	PlatformIOS     Platform = "ios"
	PlatformAndroid Platform = "android"
	PlatformWeb     Platform = "web"
	PlatformUnknown Platform = "unknown"
)

type Device struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	DeviceID  uuid.UUID `json:"device_id"`
	Platform  Platform  `json:"platform"`
	Token     string    `json:"token"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Prefs struct {
	UserID   uuid.UUID `json:"user_id"`
	Messages bool      `json:"messages"`
	Groups   bool      `json:"groups"`
	Calls    bool      `json:"calls"`
	Stories  bool      `json:"stories"`
}

type RegisterDeviceRequest struct {
	// DeviceID is optional — falls back to JWT device claim.
	DeviceID string   `json:"device_id"`
	Platform Platform `json:"platform"`
	Token    string   `json:"token" binding:"required"`
}

type PatchPrefsRequest struct {
	Messages *bool `json:"messages"`
	Groups   *bool `json:"groups"`
	Calls    *bool `json:"calls"`
	Stories  *bool `json:"stories"`
}

// PushJob is enqueued on Redis for a future worker (FCM/APNs).
type PushJob struct {
	UserID   string            `json:"user_id"`
	Title    string            `json:"title"`
	Body     string            `json:"body"`
	Data     map[string]string `json:"data,omitempty"`
	Category string            `json:"category"` // messages | groups | calls | stories
}
