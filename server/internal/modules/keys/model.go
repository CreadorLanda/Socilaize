// Package keys serves pre-key bundles for X3DH session setup. All public
// material on the wire is base64-url; the repository stores raw bytes.
package keys

// SignedPreKey is the device's currently published signed pre-key. The
// signature is over PublicKey, verifiable with IdentityKey.
type SignedPreKey struct {
	KeyID     int    `json:"key_id" binding:"required"`
	PublicKey string `json:"public_key" binding:"required"`
	Signature string `json:"signature" binding:"required"`
}

// OneTimePreKey is a single-use ephemeral key. Each fetch of a bundle
// consumes one of these atomically.
type OneTimePreKey struct {
	KeyID     int    `json:"key_id" binding:"required"`
	PublicKey string `json:"public_key" binding:"required"`
}

// UploadRequest is what the device PUTs to /users/me/keys. The identity
// key + signed pre-key replace any existing copy; the one-time keys are
// appended (UNIQUE on key_id stops accidental re-uploads).
type UploadRequest struct {
	IdentityKey  string          `json:"identity_key"  binding:"required"`
	SignedPreKey SignedPreKey    `json:"signed_pre_key" binding:"required"`
	OneTimeKeys  []OneTimePreKey `json:"one_time_pre_keys"`
}

// UploadResponse tells the client how many one-time keys are still on the
// server after the upload, so it knows when to top up.
type UploadResponse struct {
	OneTimeRemaining int `json:"one_time_remaining"`
}

// Bundle is the per-device payload returned to a caller starting a new
// session with this user. OneTimePreKey may be nil if the recipient's
// pool was exhausted — clients fall back to signed-pre-key-only X3DH.
type Bundle struct {
	UserID        string         `json:"user_id"`
	DeviceID      string         `json:"device_id"`
	IdentityKey   string         `json:"identity_key"`
	SignedPreKey  SignedPreKey   `json:"signed_pre_key"`
	OneTimePreKey *OneTimePreKey `json:"one_time_pre_key,omitempty"`
}

// CountResponse — current OTK reservoir for the caller's device.
type CountResponse struct {
	OneTimeRemaining int `json:"one_time_remaining"`
}
