// Package stickers stores user-imported sticker packs.
//
// Importing is always user-initiated: the client hands us files the person
// picked themselves (loose .webp files, or a .wastickers bundle they
// exported). There is no API to read anyone's sticker library, and we
// never go looking for one.
package stickers

import (
	"time"

	"github.com/google/uuid"
)

// Published sticker-format limits. Enforced on import so packs stay valid
// for interop in both directions.
const (
	StickerDimension  = 512
	TrayDimension     = 96
	MaxStaticBytes    = 100 * 1024
	MaxAnimatedBytes  = 500 * 1024
	MaxTrayBytes      = 50 * 1024
	MinStickersInPack = 3
	MaxStickersInPack = 30
)

type Pack struct {
	ID       uuid.UUID `json:"id"`
	OwnerID  uuid.UUID `json:"owner_id"`
	Name     string    `json:"name"`
	Author   string    `json:"author,omitempty"`
	TrayURL  *string   `json:"tray_url,omitempty"`
	SourceID *string   `json:"source_id,omitempty"`
	Animated bool      `json:"animated"`
	// The saved-stickers pack. Exempt from the minimum size and never
	// carries a source_id, so it is skipped by bundle dedupe.
	IsFavorites bool      `json:"is_favorites"`
	CreatedAt   time.Time `json:"created_at"`
	Stickers    []Sticker `json:"stickers,omitempty"`
	Count       int       `json:"count"`
}

type Sticker struct {
	ID       uuid.UUID `json:"id"`
	MediaID  uuid.UUID `json:"media_id"`
	URL      string    `json:"url"`
	Emojis   string    `json:"emojis,omitempty"`
	Position int       `json:"position"`
}

// CreatePackRequest is what the client sends after uploading each sticker
// through the media endpoint. We take media ids, not bytes — the upload
// path already handles size limits, ownership and storage.
type CreatePackRequest struct {
	Name     string         `json:"name" binding:"required"`
	Author   string         `json:"author"`
	TrayID   *uuid.UUID     `json:"tray_media_id"`
	SourceID *string        `json:"source_id"`
	Animated bool           `json:"animated"`
	Stickers []StickerInput `json:"stickers" binding:"required"`
}

// SaveStickerRequest adds one sticker to the caller's favourites pack,
// creating that pack on first use.
type SaveStickerRequest struct {
	MediaID uuid.UUID `json:"media_id" binding:"required"`
	Emojis  string    `json:"emojis"`
}

type StickerInput struct {
	MediaID uuid.UUID `json:"media_id" binding:"required"`
	Emojis  string    `json:"emojis"`
}
