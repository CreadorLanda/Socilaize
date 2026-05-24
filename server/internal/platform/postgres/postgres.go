// Package postgres exposes a typed pgx pool with a short open/close API.
//
// We intentionally avoid an ORM. Repositories build their own queries with
// pgx; the platform package owns only connection lifecycle and pings.
//
// We always run pgx in "exec" mode (no cached prepared statements). This
// keeps the same code path working against:
//   - a direct Postgres (local Docker, raw RDS),
//   - Supabase via Supavisor in transaction mode (port 6543),
//   - any PgBouncer in transaction mode,
//
// at the cost of a few microseconds per query — a fair trade for not having
// to special-case poolers in the connection layer.
package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("parse postgres url: %w", err)
	}
	// Transaction-mode pooler compatibility: no shared prepared-statement cache.
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	cfg.ConnConfig.StatementCacheCapacity = 0
	cfg.ConnConfig.DescriptionCacheCapacity = 0

	cfg.MaxConns = 20
	cfg.MinConns = 2
	cfg.MaxConnLifetime = time.Hour
	cfg.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("open postgres pool: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return pool, nil
}
