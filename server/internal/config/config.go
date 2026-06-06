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
}

// WAConfig wires the WhatsApp bridge sidecar (Baileys). The Go API only
// talks to it via HTTP; this is the only place that needs to know the URL.
type WAConfig struct {
	BridgeURL     string
	InternalToken string
	// InternalAddr is the mTLS-protected address for internal bridge
	// webhooks (e.g. ":9090"). If empty the internal server is not started.
	InternalAddr string
}

// CryptoConfig holds keys for at-rest encryption of message content.
type CryptoConfig struct {
	// MessageKey is a hex-encoded 32-byte AES-256 key. If empty, messages
	// are stored in plaintext (dev fallback). Generate with:
	//   openssl rand -hex 32
	MessageKey string
}

type HTTPConfig struct {
	Addr string
	// TLS cert paths — when set the public server also supports HTTPS.
	// For mTLS with the bridge, see WA.InternalAddr and TLSCA.
	TLSCert     string
	TLSKey      string
	TLSCACert   string
	TLSClientCA string
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
			Addr:        getenv("HTTP_ADDR", ":8080"),
			TLSCert:     os.Getenv("TLS_SERVER_CERT"),
			TLSKey:      os.Getenv("TLS_SERVER_KEY"),
			TLSCACert:   os.Getenv("TLS_CA_CERT"),
			TLSClientCA: os.Getenv("TLS_CLIENT_CA_CERT"),
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
		},
		Crypto: CryptoConfig{
			MessageKey: os.Getenv("WA_MESSAGE_KEY"),
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
