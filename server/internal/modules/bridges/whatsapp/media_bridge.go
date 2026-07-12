package whatsapp

import (
	"context"
	"io"
	"strings"

	"github.com/google/uuid"

	"github.com/CreadorLanda/Socilaize/server/internal/modules/media"
)

// mediaBridge adapts media.Service to the whatsapp MediaStore interface.
type mediaBridge struct {
	svc *media.Service
}

func NewMediaBridge(svc *media.Service) MediaStore {
	if svc == nil {
		return nil
	}
	return &mediaBridge{svc: svc}
}

func (b *mediaBridge) Upload(
	ctx context.Context,
	ownerID uuid.UUID,
	filename string,
	contentType string,
	r io.Reader,
	sizeHint int64,
	width, height, durationMs *int,
) (UploadedMedia, error) {
	obj, err := b.svc.Upload(ctx, ownerID, filename, contentType, r, sizeHint, width, height, durationMs)
	if err != nil {
		return UploadedMedia{}, err
	}
	return UploadedMedia{
		ID:       obj.ID.String(),
		URL:      obj.URL,
		MimeType: obj.MimeType,
		Kind:     string(obj.Kind),
	}, nil
}

func (b *mediaBridge) Open(ctx context.Context, id uuid.UUID) (UploadedMedia, io.ReadCloser, error) {
	obj, f, err := b.svc.Open(ctx, id)
	if err != nil {
		return UploadedMedia{}, nil, err
	}
	return UploadedMedia{
		ID:       obj.ID.String(),
		URL:      obj.URL,
		MimeType: obj.MimeType,
		Kind:     string(obj.Kind),
	}, f, nil
}

// parseMediaID extracts a media UUID from /api/media/{id}/file or bare UUID.
func parseMediaID(url string) (uuid.UUID, bool) {
	s := strings.TrimSpace(url)
	if s == "" {
		return uuid.Nil, false
	}
	if id, err := uuid.Parse(s); err == nil {
		return id, true
	}
	// /api/media/<uuid>/file
	const prefix = "/api/media/"
	if i := strings.Index(s, prefix); i >= 0 {
		rest := s[i+len(prefix):]
		rest = strings.TrimSuffix(rest, "/file")
		if slash := strings.IndexByte(rest, '/'); slash >= 0 {
			rest = rest[:slash]
		}
		if id, err := uuid.Parse(rest); err == nil {
			return id, true
		}
	}
	return uuid.Nil, false
}
