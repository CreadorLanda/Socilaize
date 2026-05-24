package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/CreadorLanda/Socilaize/server/internal/config"
)

// Sentinel errors translated to HTTP status by the controller.
var (
	ErrInvalidCode    = errors.New("invalid_code")
	ErrCodeExpired    = errors.New("code_expired")
	ErrRateLimited    = errors.New("rate_limited")
	ErrNotImplemented = errors.New("not_implemented")
)

// Service holds the business logic for auth. Controllers stay thin.
type Service struct {
	repo *Repository
	rdb  *redis.Client
	cfg  config.JWTConfig
}

func NewService(repo *Repository, rdb *redis.Client, cfg config.JWTConfig) *Service {
	return &Service{repo: repo, rdb: rdb, cfg: cfg}
}

// Start issues a 6-digit OTP for the phone, stores it in Redis with a 5 minute
// TTL, and (for now) returns it in the response in dev. In prod this hands off
// to an SMS provider and returns only metadata.
//
// Skeleton: real SMS delivery + per-phone rate limiting land in backend/auth.
func (s *Service) Start(ctx context.Context, phone string) (code string, err error) {
	// per-phone rate limit
	rlKey := "rl:auth:start:" + sha256Hex(phone)
	if err := s.takeBucket(ctx, rlKey, 5, time.Minute); err != nil {
		return "", err
	}
	code = randomDigits(6)
	if err := s.rdb.Set(ctx, otpKey(phone), code, 5*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("store otp: %w", err)
	}
	return code, nil
}

// Verify exchanges (phone, code) for a fresh access + refresh token pair,
// creating the user lazily on first login.
//
// Skeleton: this is the canonical happy path; pre-key bundle upload and
// device-trust events land in backend/auth.
func (s *Service) Verify(ctx context.Context, in VerifyRequest) (*Tokens, *User, error) {
	got, err := s.rdb.Get(ctx, otpKey(in.Phone)).Result()
	if errors.Is(err, redis.Nil) {
		return nil, nil, ErrCodeExpired
	}
	if err != nil {
		return nil, nil, fmt.Errorf("read otp: %w", err)
	}
	if got != in.Code {
		return nil, nil, ErrInvalidCode
	}
	// one-time use
	_ = s.rdb.Del(ctx, otpKey(in.Phone)).Err()

	phoneHash := sha256Bytes(in.Phone)
	user, err := s.repo.UserByPhoneHash(ctx, phoneHash)
	if IsNoRows(err) {
		user, err = s.repo.CreateUser(ctx, phoneHash, suggestUsername(in.Phone), "")
	}
	if err != nil {
		return nil, nil, fmt.Errorf("load/create user: %w", err)
	}

	// Signal identity is supplied by the device on first registration; for now
	// the skeleton inserts an empty placeholder so the row exists.
	deviceID, err := s.repo.RegisterDevice(ctx, user.ID, in.Device, in.Platform, []byte{})
	if err != nil {
		return nil, nil, fmt.Errorf("register device: %w", err)
	}

	tokens, err := s.issueTokens(user.ID, deviceID)
	if err != nil {
		return nil, nil, err
	}
	if err := s.repo.CreateSession(ctx, user.ID, deviceID,
		sha256Bytes(tokens.AccessToken), sha256Bytes(tokens.RefreshToken)); err != nil {
		return nil, nil, fmt.Errorf("persist session: %w", err)
	}
	return tokens, user, nil
}

// Refresh rotates a refresh token. The repository layer should track the
// refresh family to detect re-use; this skeleton emits a fresh pair.
func (s *Service) Refresh(_ context.Context, _ string) (*Tokens, error) {
	return nil, ErrNotImplemented
}

func (s *Service) issueTokens(userID, deviceID uuid.UUID) (*Tokens, error) {
	now := time.Now()
	access, err := s.signJWT(jwt.MapClaims{
		"sub": userID.String(),
		"dev": deviceID.String(),
		"iat": now.Unix(),
		"exp": now.Add(s.cfg.AccessTokenTTL).Unix(),
		"typ": "access",
	})
	if err != nil {
		return nil, err
	}
	refresh, err := s.signJWT(jwt.MapClaims{
		"sub": userID.String(),
		"dev": deviceID.String(),
		"iat": now.Unix(),
		"exp": now.Add(s.cfg.RefreshTokenTTL).Unix(),
		"typ": "refresh",
	})
	if err != nil {
		return nil, err
	}
	return &Tokens{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresAt:    now.Add(s.cfg.AccessTokenTTL),
	}, nil
}

func (s *Service) signJWT(claims jwt.MapClaims) (string, error) {
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(s.cfg.Secret))
}

// takeBucket implements a tiny fixed-window rate limit on Redis. Returns
// ErrRateLimited when the bucket is empty for the current window.
func (s *Service) takeBucket(ctx context.Context, key string, max int64, window time.Duration) error {
	pipe := s.rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, window)
	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("rate-limit: %w", err)
	}
	if incr.Val() > max {
		return ErrRateLimited
	}
	return nil
}

func otpKey(phone string) string { return "otp:" + sha256Hex(phone) }

// suggestUsername produces a deterministic placeholder until the client
// completes the profile-setup flow that already exists in the mobile app.
func suggestUsername(phone string) string { return "u" + sha256Hex(phone)[:10] }

func sha256Bytes(s string) []byte { h := sha256.Sum256([]byte(s)); return h[:] }
func sha256Hex(s string) string {
	b := sha256Bytes(s)
	return base64.RawURLEncoding.EncodeToString(b)
}

func randomDigits(n int) string {
	const digits = "0123456789"
	buf := make([]byte, n)
	_, _ = rand.Read(buf)
	for i, b := range buf {
		buf[i] = digits[int(b)%len(digits)]
	}
	return string(buf)
}
