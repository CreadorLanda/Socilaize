# Repository Guidelines

## Project Structure & Module Organization

Two deployables: `mobile/` (Expo/React Native client) and `server/` (Go API, one binary). The `apps/` + `packages/` tree drawn in root `README.md` is aspirational — ignore it.

`server/internal/modules/<name>/` is MVC: `model.go`, `repository.go` (hand-written SQL on `pgx`, no ORM), `service.go`, `controller.go`, `routes.go`. Modules must not import another module's `service`/`repository`. Shared infrastructure lives in `internal/platform/{postgres,redis,realtime,tokens}` — `realtime` is the WebSocket hub, `tokens` the JWT pair. Schema changes are numbered up/down pairs in `server/migrations/` (golang-migrate).

`mobile/app/` is `expo-router` file-based routing. `data/api/*.ts` wrap `data/api/client.ts`, which injects the bearer token and replays a single shared refresh on 401. State lives in `data/*-store.ts` as plain modules over `useSyncExternalStore` — no Redux or Zustand; follow that pattern. All visual values come from semantic tokens in `constants/theme.ts` (spec: `docs/tech/design-system.md`); never use raw palette values.

`docs/` and `docs/pt/` are mirrored language trees — change a page in one, change its twin.

## Build, Test, and Development Commands

Use `bun`, never npm.

```bash
cd mobile && bun install && bun run dev   # detects LAN IP, writes .env, boots server + Metro
bun run android | ios | web | lint
cd server && make docker-up && make migrate-up && make dev
make test | fmt | vet | tidy | build
go test ./internal/platform/tokens -run TestSignParseRoundTrip   # single test
```

Copy `server/.env.example` to `.env` first.

## Coding Style & Naming Conventions

TypeScript is `strict` with the `@/*` path alias, linted by `eslint-config-expo`. Go is formatted with `gofmt -s`. Wrap errors (`fmt.Errorf("...: %w", err)`) and expose package sentinels (`ErrInvalidCode`) that controllers map to HTTP. Every service and repository method takes `context.Context` first. JSON is `snake_case`, Go identifiers `CamelCase`, times UTC/RFC 3339.

## Testing Guidelines

Go tests are `*_test.go` beside the code, mostly `service_test.go` per module. The three integration tests in `internal/modules/messages` self-skip unless `TEST_POSTGRES_URL` is exported — run `make docker-up-local` and set it, or a green `make test` is hiding them. Mobile has no test runner configured.

## Commit & Pull Request Guidelines

Conventional Commits with a scope: `feat(stories): background publish with toast status`. Work on `backend/<feature>` branches. Fill in `.github/PULL_REQUEST_TEMPLATE/standard.md` and add a `CHANGELOG.md` entry for user-visible changes.
