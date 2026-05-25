package keys

import (
	"bytes"
	"encoding/base64"
	"testing"
)

// Clients in the wild end up using either raw-url base64 (no padding,
// `_-` alphabet) or std base64 (with padding, `+/` alphabet). The
// service's decode() helper has to accept both so the choice of client
// crypto lib doesn't break uploads.
func TestDecodeAcceptsBothBase64Variants(t *testing.T) {
	payload := []byte{0xff, 0x00, 0x10, 0x20, 0x80, 0x7f}

	rawURL := base64.RawURLEncoding.EncodeToString(payload)
	std := base64.StdEncoding.EncodeToString(payload)

	for _, tt := range []struct {
		name string
		in   string
	}{
		{"raw url", rawURL},
		{"standard", std},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, err := decode(tt.in)
			if err != nil {
				t.Fatalf("decode(%q): %v", tt.in, err)
			}
			if !bytes.Equal(got, payload) {
				t.Fatalf("decode(%q) = %x, want %x", tt.in, got, payload)
			}
		})
	}
}

func TestDecodeRejectsGarbage(t *testing.T) {
	if _, err := decode("this is not base64!!"); err == nil {
		t.Fatal("expected error for non-base64 input, got nil")
	}
}

// encode is the inverse direction. The contract is "always raw-url out"
// because that's what the wire spec promises peers.
func TestEncodeIsRawURL(t *testing.T) {
	got := encode([]byte{0xff, 0xfe, 0xfd})
	// "/+" never appear in raw-url, padding "=" never appears.
	if got != base64.RawURLEncoding.EncodeToString([]byte{0xff, 0xfe, 0xfd}) {
		t.Fatalf("encode produced %q, expected raw-url", got)
	}
}
