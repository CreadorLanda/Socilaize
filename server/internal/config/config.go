// Package config loads environment-based configuration once at startup.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Env      string
	HTTP     HTTPConfig
	Postgres PostgresConfig
	Redis    RedisConfig
	JWT      JWTConfig
	WA       WAConfig
	Crypto   CryptoConfig
	Media    MediaConfig
	Push     PushConfig
}

// PushConfig configures the offline push worker.
type PushConfig struct {
	// WebhookURL optional HTTP endpoint that receives push jobs + device tokens.
	// Useful for a small FCM relay or n8n/Make webhook while native FCM is pending.
	WebhookURL string
}

// MediaConfig controls on-disk upload storage (S3/R2 later).
type MediaConfig struct {
	// Dir is the absolute/relative root for stored files.
	Dir string
	// MaxUploadBytes caps a single upload (0 = default 25 MiB).
	MaxUploadBytes int64
}

// WAConfig wires the WhatsApp bridge sidecar (Baileys) and its mTLS
// internal server for webhook events.
type WAConfig struct {
	BridgeURL     string
	InternalToken string
	InternalAddr  string
	TLSCACert     string
	TLSCert       string
	TLSKey        string
}

// CryptoConfig holds keys for at-rest encryption of message content.
type CryptoConfig struct {
	MessageKey string
}

type HTTPConfig struct {
	Addr string
}

type PostgresConfig struct {
	URL string
}

type RedisConfig struct {
	URL string
}

type JWTConfig struct {
	Secret          string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
}

func Load() (Config, error) {
	cfg := Config{
		Env: getenv("APP_ENV", "dev"),
		HTTP: HTTPConfig{
			Addr: getenv("HTTP_ADDR", ":8080"),
		},
		Postgres: PostgresConfig{
			URL: os.Getenv("POSTGRES_URL"),
		},
		Redis: RedisConfig{
			URL: os.Getenv("REDIS_URL"),
		},
		JWT: JWTConfig{
			Secret:          os.Getenv("JWT_SECRET"),
			AccessTokenTTL:  getenvDuration("JWT_ACCESS_TTL", 15*time.Minute),
			RefreshTokenTTL: getenvDuration("JWT_REFRESH_TTL", 30*24*time.Hour),
		},
		WA: WAConfig{
			BridgeURL:     os.Getenv("WA_BRIDGE_URL"),
			InternalToken: os.Getenv("SOCIALIZE_INTERNAL_TOKEN"),
			InternalAddr:  os.Getenv("WA_INTERNAL_ADDR"),
			TLSCACert:     os.Getenv("TLS_CA_CERT"),
			TLSCert:       os.Getenv("TLS_SERVER_CERT"),
			TLSKey:        os.Getenv("TLS_SERVER_KEY"),
		},
		Crypto: CryptoConfig{
			MessageKey: os.Getenv("WA_MESSAGE_KEY"),
		},
		Media: MediaConfig{
			Dir:            getenv("MEDIA_DIR", "./data/media"),
			MaxUploadBytes: getenvInt64("MEDIA_MAX_BYTES", 25<<20),
		},
		Push: PushConfig{
			WebhookURL: os.Getenv("PUSH_WEBHOOK_URL"),
		},
	}

	var missing []string
	if cfg.Postgres.URL == "" {
		missing = append(missing, "POSTGRES_URL")
	}
	if cfg.Redis.URL == "" {
		missing = append(missing, "REDIS_URL")
	}
	if cfg.JWT.Secret == "" {
		missing = append(missing, "JWT_SECRET")
	}
	if len(missing) > 0 {
		return cfg, fmt.Errorf("missing required env vars: %v", missing)
	}
	if len(cfg.JWT.Secret) < 32 {
		return cfg, errors.New("JWT_SECRET must be at least 32 bytes")
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getenvDuration(key string, fallback time.Duration) time.Duration {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
		if secs, err := strconv.Atoi(v); err == nil {
			return time.Duration(secs) * time.Second
		}
	}
	return fallback
}

func getenvInt64(key string, fallback int64) int64 {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}
