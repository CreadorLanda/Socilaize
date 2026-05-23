# Repository Guidelines

Socialize is currently a **documentation-only** repository for a planned open-source messaging platform. No application source code lives here yet — only Markdown specs, roadmaps, and contributor guides that describe the future product (Go backend, React Native client, etc.).

## Project Structure & Module Organization

Root holds top-level guides: `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`. Everything else lives under `docs/`, which is split into two **mirrored language trees**: `docs/` (English, default) and `docs/pt/` (Portuguese). Each tree carries the same six sub-areas:

- `central/` — onboarding (`getting-started.md`, `faq.md`)
- `features/` — product feature specs (`messaging`, `privacy`, `ai`, `social`, `customization`, `fun`, `innovations`)
- `tech/` — `architecture.md`, `api.md`, `database.md`, `backend-go.md`, `mobile-rn.md`, `infrastructure.md`
- `security/` — `encryption.md`, `privacy-policy.md`, `best-practices.md`, `audit.md`
- `roadmap/` — `roadmap.md` plus per-version files (`v1.0.0.md` … `v3.0.0.md`)
- `contrib/` — `setup.md`, `style-guide.md`, `testing.md`

When adding or renaming a page in one tree, make the parallel change in the other and update both `docs/README.md` and `docs/pt/README.md` indexes. GitHub assets live under `.github/ISSUE_TEMPLATE/` and `.github/PULL_REQUEST_TEMPLATE/standard.md`.

## Build, Test, and Development Commands

There is **no build system** in this repo. Commands referenced inside `docs/contrib/setup.md` and `docs/contrib/testing.md` (`npm install`, `npm run dev`, `npm run test`, `go test ./...`) describe the planned product and do not run here — don't introduce them at the root. Preview Markdown locally with your editor or a tool like `grip`.

## Coding Style & Naming Conventions

- Markdown only; no linter or formatter is configured.
- File and directory names are lowercase-hyphenated (`getting-started.md`, `privacy-policy.md`); versioned files use `vMAJOR.MINOR.PATCH.md`.
- Keep section headings aligned between `docs/` and `docs/pt/` so cross-links and the indexes match.
- Dates use ISO 8601 (`YYYY-MM-DD`) per `CHANGELOG.md`.

## Commit & Pull Request Guidelines

Use **Conventional Commits** as documented in `CONTRIBUTING.md`: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`. Recent history is dominated by `docs:` with short imperative subjects (e.g. `Expand documentation with detailed content`).

PRs must follow `.github/PULL_REQUEST_TEMPLATE/standard.md` — fill in Description, Related Issues, Checklist (tests, docs, style guide, changelog), Tests run, Screenshots, and change type. Add a matching entry to `CHANGELOG.md` for any user-visible documentation change.
