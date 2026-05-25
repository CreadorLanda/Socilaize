package tokens

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSignParseRoundTrip(t *testing.T) {
	secret := []byte("test-secret")
	now := time.Now().Truncate(time.Second)
	in := Claims{
		UserID:   uuid.New(),
		DeviceID: uuid.New(),
		Type:     TypeAccess,
		IssuedAt: now,
		Expires:  now.Add(15 * time.Minute),
	}

	s, err := Sign(secret, in)
	if err != nil {
		t.Fatalf("Sign: %v", err)
	}
	if s == "" || !strings.Contains(s, ".") {
		t.Fatalf("Sign returned %q, expected a compact JWS", s)
	}

	out, err := Parse(secret, s)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if out.UserID != in.UserID {
		t.Errorf("user mismatch: %v != %v", out.UserID, in.UserID)
	}
	if out.DeviceID != in.DeviceID {
		t.Errorf("device mismatch: %v != %v", out.DeviceID, in.DeviceID)
	}
	if out.Type != in.Type {
		t.Errorf("type mismatch: %q != %q", out.Type, in.Type)
	}
	if !out.IssuedAt.Equal(in.IssuedAt) {
		t.Errorf("iat mismatch: %v != %v", out.IssuedAt, in.IssuedAt)
	}
	if !out.Expires.Equal(in.Expires) {
		t.Errorf("exp mismatch: %v != %v", out.Expires, in.Expires)
	}
}

func TestParseWrongSecretFails(t *testing.T) {
	good := []byte("good")
	bad := []byte("bad")
	s, err := Sign(good, Claims{
		UserID:   uuid.New(),
		DeviceID: uuid.New(),
		Type:     TypeAccess,
		IssuedAt: time.Now(),
		Expires:  time.Now().Add(time.Minute),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Parse(bad, s); !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected ErrInvalid, got %v", err)
	}
}

func TestParseExpiredFails(t *testing.T) {
	secret := []byte("test-secret")
	s, err := Sign(secret, Claims{
		UserID:   uuid.New(),
		DeviceID: uuid.New(),
		Type:     TypeAccess,
		IssuedAt: time.Now().Add(-2 * time.Minute),
		Expires:  time.Now().Add(-1 * time.Minute),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := Parse(secret, s); !errors.Is(err, ErrExpired) {
		t.Fatalf("expected ErrExpired, got %v", err)
	}
}

func TestParseMalformedFails(t *testing.T) {
	if _, err := Parse([]byte("x"), "not-a-jwt"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected ErrInvalid for garbage, got %v", err)
	}
}
