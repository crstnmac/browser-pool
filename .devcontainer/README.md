# Dev Container Setup

This directory contains the development container configuration for Browser Pool.

## Files Overview

- **Dockerfile**: Bun-based app image with CLI tooling (DB/Redis run separately)
- **devcontainer.json**: Dev Container config that references the compose file
- **docker-compose.yml**: App container plus PostgreSQL + Redis services
- **post-create.sh**: Runs after container creation (installs deps, migrates DB)
- **post-start.sh**: Runs when container starts (checks service health)

## Quick Start with VS Code

1. Install Docker Desktop and VS Code Remote - Containers extension
2. Open the project in VS Code
3. Press `Ctrl+Shift+P` (Cmd+Shift+P on Mac) → "Dev Containers: Reopen in Container"
4. Wait for the container to build and services to start
5. Run `bun run dev` to start development

## Services Included

- **PostgreSQL 16 (compose service)**: Database (port 5433)
- **Redis 7 (compose service)**: Cache and job queue (port 6380)
- **Bun Runtime**: Latest version with Node 20
- **Git & GitHub CLI**: For version control

## Port Mappings

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | Backend | Hono API server |
| 5173 | Frontend | Vite dev server |
| 5433 | PostgreSQL | Database |
| 6380 | Redis | Cache/queue |

## Commands

```bash
# From host machine (outside container)
docker compose -f .devcontainer/docker-compose.yml build     # Build images
docker compose -f .devcontainer/docker-compose.yml up -d     # Start dev + services
docker compose -f .devcontainer/docker-compose.yml down      # Stop everything

# Inside container
bun run dev              # Start frontend + backend
bun run db:migrate       # Run migrations
bun run db:seed          # Seed database
```

## Customization

### Adding VS Code Extensions

Edit `devcontainer.json` and add to the `extensions` array:
```json
"extensions": [
  "existing-extension",
  "new-extension-id"
]
```

### Changing Base Image

Edit `Dockerfile` to change the base image or add system dependencies:
```dockerfile
RUN apt-get update && apt-get install -y your-package
```

### Environment Variables

Modify `docker-compose.yml` to add environment variables for dev services.

## Troubleshooting

### Build fails
```bash
# Rebuild without cache
docker-compose -f .devcontainer/docker-compose.yml build --no-cache
```

### Services won't start
```bash
# Check service logs
docker-compose -f .devcontainer/docker-compose.yml logs postgres
docker-compose -f .devcontainer/docker-compose.yml logs redis
```

### Port already in use
Edit `docker-compose.yml` port mappings to use different ports.

### Permission errors
Ensure the dev user has proper permissions:
```bash
docker-compose -f .devcontainer/docker-compose.yml exec dev chown -R developer:developer /workspace
```

## For Team Members

New contributors can get started in 3 steps:
1. Install Docker Desktop
2. Open project in VS Code
3. Click "Reopen in Container"

That's it! Everything else is automated. 🚀
