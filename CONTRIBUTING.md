# Contributing to Browser Pool

Welcome to Browser Pool! This guide will help you set up your development environment and contribute to the project.

## Development Setup

### Using VS Code Dev Containers (Recommended)

The easiest way to get started is to use VS Code Dev Containers. This sets up a complete development environment with all dependencies.

**Requirements:**
- Docker Desktop or Docker Engine
- VS Code with the Remote - Containers extension

**Steps:**
1. Clone the repository
2. Open the project in VS Code
3. Click the "Reopen in Container" button when prompted, or:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Dev Containers: Reopen in Container"
   - Select the Browser Pool Development container

VS Code will:
- Build the Docker image
- Start PostgreSQL and Redis containers
- Install all dependencies
- Run database migrations
- Set up the development environment

### Using Docker Compose Directly

If you prefer to manage containers manually:

```bash
# Start all services
make devcontainer-up

# Open a shell in the dev container
make devcontainer-shell

# Stop all services
make devcontainer-down
```

### Local Development (Without Docker)

If you prefer local development, you'll need:

- **Bun** 1.3+: https://bun.sh
- **Node.js** 20+: https://nodejs.org
- **PostgreSQL** 15+: https://www.postgresql.org
- **Redis** 7+: https://redis.io

**Setup:**
```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
cp frontend/.env.example frontend/.env

# Run database migrations
bun run db:migrate

# (Optional) Seed the database
bun run db:seed

# (Optional) Create admin user
bun run create:admin

# Start development servers
bun run dev
```

## Development Workflow

### Running the Development Servers

Start both frontend and backend with a single command:

```bash
bun run dev
# or use the Makefile
make dev
```

This starts:
- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:3000/api/docs

### Project Structure

```
browser-pool/
├── src/                    # Backend source code (Node.js + Hono)
│   ├── index.ts           # Application entry point
│   ├── routes/            # API route handlers
│   ├── middleware.ts      # Authentication and request middleware
│   ├── email.ts           # Email service
│   ├── redis.ts           # Redis client
│   ├── queue.ts           # BullMQ job queue
│   ├── scheduler.ts       # Screenshot scheduler
│   └── ...
├── frontend/              # React SPA frontend
│   ├── src/
│   ├── public/
│   └── package.json
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── migrations/
├── scripts/               # Utility scripts
│   ├── create-admin.ts
│   ├── seed.ts
│   └── migrate-security-fields.ts
├── package.json
├── tsconfig.json
├── .devcontainer/         # Dev container configuration
└── Makefile               # Development commands
```

### Useful Commands

**Development:**
```bash
make dev                   # Start frontend and backend
make install              # Install dependencies
make build                # Build for production
```

**Testing:**
```bash
make test                 # Run tests
make test-watch          # Run tests in watch mode
make test-coverage       # Run tests with coverage
```

**Database:**
```bash
make db-migrate          # Run pending migrations
make db-seed             # Seed database
make db-studio           # Open Prisma Studio
make db-generate         # Generate Prisma client
```

**Code Quality:**
```bash
make lint                # Run linter
```

**Utilities:**
```bash
make create-admin        # Create an admin user
make clean               # Clean build artifacts
```

## Technology Stack

### Backend
- **Framework**: Hono.js (lightweight web framework)
- **Runtime**: Bun (JavaScript runtime)
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with BullMQ
- **API Docs**: Swagger/OpenAPI
- **Authentication**: JWT + API Keys
- **Email**: Nodemailer
- **Screenshot**: Playwright

### Frontend
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI + shadcn/ui
- **HTTP Client**: Axios
- **Router**: React Router v7

## Code Style & Conventions

### TypeScript
- Use strict mode
- Add return types to functions
- Prefer types over interfaces for object shapes
- Use const for all variable declarations

### Code Formatting
- We use **Biome** for formatting and linting
- Format on save is enabled in dev containers
- Run `make lint` before committing

### Git Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Keep commits focused and atomic
   - Write descriptive commit messages
   - Test your changes locally

3. **Push and create a PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Use the PR template
   - Link related issues
   - Request reviews from maintainers

### Commit Message Convention

Follow conventional commits:

```
feat: Add new screenshot filtering
fix: Resolve race condition in job queue
docs: Update API documentation
refactor: Simplify rate limiting logic
test: Add tests for webhook handler
```

## Database Migrations

When you modify `prisma/schema.prisma`:

1. Create a new migration:
   ```bash
   bun run db:migrate
   ```

2. Review the generated SQL in `prisma/migrations/`

3. Commit the migration with your code changes

## Environment Variables

Essential variables for development:

| Variable | Purpose | Default |
|----------|---------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Backend port | `3000` |
| `DATABASE_URL` | PostgreSQL connection | See .env.example |
| `REDIS_URL` | Redis connection | See .env.example |
| `JWT_SECRET` | JWT signing secret | Required |
| `API_KEY_PREFIX` | API key prefix | `bp_` |

See `.env.example` for all available options.

## Debugging

### Backend Debugging
The dev container includes VS Code debugger support. Add breakpoints and use the debugger configuration in `.vscode/launch.json`.

### Frontend Debugging
Use React DevTools and Vite DevTools in your browser.

### Database Debugging
Open Prisma Studio:
```bash
make db-studio
```

## Testing

### Running Tests
```bash
make test              # Run all tests once
make test-watch       # Run tests in watch mode
make test-coverage    # Generate coverage report
```

### Writing Tests
- Place test files next to source files with `.test.ts` extension
- Use Jest for unit/integration tests
- Mock external services (Redis, Database, etc.)

## Performance Considerations

- The dev container uses volume mounts for live code reloading
- `node_modules` are in separate volumes to avoid disk sync issues
- Database is persisted in Docker volumes between sessions

## Getting Help

- Check existing issues and discussions
- Review the API documentation at http://localhost:3000/api/docs
- Look at the code comments and types for guidance
- Ask in PRs or discussions for clarification

## Troubleshooting

### Container won't start
```bash
# Rebuild the image
make devcontainer-build

# Check Docker logs
docker-compose -f .devcontainer/docker-compose.yml logs
```

### Database connection errors
```bash
# Verify PostgreSQL is running
docker-compose -f .devcontainer/docker-compose.yml ps

# Check connection string
echo $DATABASE_URL
```

### Port conflicts
If ports are already in use, modify `.devcontainer/docker-compose.yml` port mappings.

### Node modules issues
```bash
# Clean and reinstall
rm -rf node_modules frontend/node_modules
bun install
```

## Next Steps

1. Read the project README
2. Check out open issues labeled "good first issue"
3. Review the API documentation
4. Start with a small bug fix or feature

Happy coding! 🚀
