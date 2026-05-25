package users

import (
	"time"

	"github.com/google/uuid"
)

// User is the public-facing shape of a user account. Anything the API
// returns lives here; persistence-only fields stay in the repository.
type User struct {
	ID              uuid.UUID `json:"id"`
	Username        string    `json:"username"`
	DisplayName     string    `json:"display_name"`
	Bio             string    `json:"bio,omitempty"`
	AvatarURI       string    `json:"avatar_uri,omitempty"`
	UsernamePublic  bool      `json:"username_public"`
	CreatedAt       time.Time `json:"created_at"`
}

// PatchRequest is the body of PATCH /users/me. Pointer fields mean "only
// touch the columns the client actually sent".
type PatchRequest struct {
	Username       *string `json:"username,omitempty"        binding:"omitempty,min=3,max=20"`
	DisplayName    *string `json:"display_name,omitempty"    binding:"omitempty,min=1,max=100"`
	Bio            *string `json:"bio,omitempty"             binding:"omitempty,max=500"`
	AvatarURI      *string `json:"avatar_uri,omitempty"      binding:"omitempty,url"`
	UsernamePublic *bool   `json:"username_public,omitempty"`
}

type AvailabilityResponse struct {
	Username  string `json:"username"`
	Available bool   `json:"available"`
}
