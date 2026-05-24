.PHONY: help dev build test tidy fmt vet lint migrate-up migrate-down docker-up docker-down docker-bridge

POSTGRES_URL ?= postgres://socialize:socialize@localhost:5432/socialize?sslmode=disable

help: ## Show this help.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

dev: ## Run the API in dev mode.
	go run ./cmd/api

build: ## Build the API binary.
	go build -o bin/api ./cmd/api

test: ## Run unit tests.
	go test ./...

tidy: ## Sync go.mod / go.sum.
	go mod tidy

fmt: ## Format the code.
	gofmt -s -w .

vet: ## Run go vet.
	go vet ./...

migrate-up: ## Apply all pending migrations.
	@command -v migrate >/dev/null 2>&1 || { echo "install golang-migrate first: https://github.com/golang-migrate/migrate"; exit 1; }
	migrate -path migrations -database "$(POSTGRES_URL)" up

migrate-down: ## Roll back the most recent migration.
	migrate -path migrations -database "$(POSTGRES_URL)" down 1

docker-up: ## Start Redis locally (use Supabase for Postgres).
	docker compose -f deploy/docker/docker-compose.yml up -d redis

docker-up-local: ## Start Redis + a local Postgres (fully offline dev).
	docker compose -f deploy/docker/docker-compose.yml --profile local-pg up -d

docker-bridge: ## Start the mautrix-whatsapp sidecar.
	docker compose -f deploy/docker/docker-compose.yml --profile bridge up -d mautrix

docker-down: ## Stop the local stack.
	docker compose -f deploy/docker/docker-compose.yml --profile local-pg --profile bridge down
