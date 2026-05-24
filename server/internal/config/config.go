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
	Secret             string
	AccessTokenTTL     time.Duration
	RefreshTokenTTL    time.Duration
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
		// also accept seconds as an integer for convenience
		if secs, err := strconv.Atoi(v); err == nil {
			return time.Duration(secs) * time.Second
		}
	}
	return fallback
}
