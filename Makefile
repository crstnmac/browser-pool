.PHONY: help devcontainer dev build test lint clean install db-migrate db-seed

help:
	@echo "Browser Pool Development Commands"
	@echo "=================================="
	@echo ""
	@echo "Devcontainer Commands:"
	@echo "  make devcontainer-build    Build devcontainer image"
	@echo "  make devcontainer-up       Start devcontainer with services"
	@echo "  make devcontainer-down     Stop devcontainer and services"
	@echo "  make devcontainer-shell    Open shell in devcontainer"
	@echo ""
	@echo "Development Commands:"
	@echo "  make dev                   Start frontend and backend concurrently"
	@echo "  make install               Install all dependencies"
	@echo "  make build                 Build for production"
	@echo "  make test                  Run tests"
	@echo "  make test-watch            Run tests in watch mode"
	@echo "  make test-coverage         Run tests with coverage"
	@echo "  make lint                  Run linter"
	@echo ""
	@echo "Database Commands:"
	@echo "  make db-migrate            Run database migrations"
	@echo "  make db-migrate-deploy     Deploy migrations in production"
	@echo "  make db-generate           Generate Prisma client"
	@echo "  make db-seed               Seed database with sample data"
	@echo "  make db-studio             Open Prisma Studio"
	@echo ""
	@echo "Utility Commands:"
	@echo "  make clean                 Clean build artifacts"
	@echo "  make create-admin          Create admin user"

# Devcontainer commands
devcontainer-build:
	docker-compose -f .devcontainer/docker-compose.yml build

devcontainer-up:
	docker-compose -f .devcontainer/docker-compose.yml up -d

devcontainer-down:
	docker-compose -f .devcontainer/docker-compose.yml down

devcontainer-shell:
	docker-compose -f .devcontainer/docker-compose.yml exec dev bash

# Development commands
dev:
	bun run dev

install:
	bun install

build:
	bun run build

test:
	bun run test

test-watch:
	bun run test:watch

test-coverage:
	bun run test:coverage

lint:
	cd frontend && bun run lint

# Database commands
db-migrate:
	bun run db:migrate

db-migrate-deploy:
	bun run db:migrate:deploy

db-generate:
	bun run db:generate

db-seed:
	bun run db:seed

db-studio:
	bun run db:studio

# Utility commands
clean:
	rm -rf dist
	rm -rf frontend/.next
	rm -rf frontend/dist
	rm -rf coverage
	rm -rf .turbo

create-admin:
	bun run create:admin
