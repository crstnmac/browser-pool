#!/bin/bash

echo "🚀 Setting up Browser Pool development environment..."

# Copy .env from example if it doesn't exist
if [ ! -f /workspaces/browser-pool/.env ]; then
  echo "📋 Creating .env from .env.example..."
  cp /workspaces/browser-pool/.env.example /workspaces/browser-pool/.env
fi

# Set database connection defaults for devcontainer services
export PGHOST=${PGHOST:-postgres}
export PGUSER=${PGUSER:-postgres}
export PGPASSWORD=${PGPASSWORD:-postgres}
export PGDATABASE=${PGDATABASE:-browser_pool}

# Set DATABASE_URL for Prisma
export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:5432/${PGDATABASE}?schema=public"

# Source the environment variables (this will override DATABASE_URL if set in .env)
set -a
source /workspaces/browser-pool/.env
set +a

# Re-apply DATABASE_URL to ensure it uses the devcontainer service name
export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:5432/${PGDATABASE}?schema=public"

# Install dependencies with bun workspace
echo "📦 Installing dependencies..."
cd /workspaces/browser-pool
bun install --frozen

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd /workspaces/browser-pool/frontend
bun install --frozen
cd /workspaces/browser-pool

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
MAX_ATTEMPTS=60
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if pg_isready -h "$PGHOST" -p 5432 -U "$PGUSER" > /dev/null 2>&1; then
    # Double-check with actual connection
    if PGPASSWORD="$PGPASSWORD" psql -U "$PGUSER" -h "$PGHOST" -d postgres -c "SELECT 1" > /dev/null 2>&1; then
      echo "✅ PostgreSQL is ready"
      break
    fi
  fi
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⚠️  PostgreSQL did not become ready in time (waited ${MAX_ATTEMPTS}s)"
    echo "ℹ️  This is non-fatal - you can continue setup manually"
    break
  fi
  sleep 1
done

# Create database if it doesn't exist
echo "🗄️  Creating database..."
createdb -U "$PGUSER" -h "$PGHOST" "$PGDATABASE" 2>/dev/null || echo "ℹ️  Database already exists"

# Generate Prisma client
echo "🔧 Generating Prisma client..."
bun run db:generate

# Run database migrations
echo "🗄️  Running database migrations..."
bun run db:migrate

# Create admin user (optional - skip if already exists)
echo "👤 Creating admin user..."
bun run create:admin 2>/dev/null || echo "⚠️  Admin user creation skipped (may already exist)"

# Seed database (optional)
echo "🌱 Seeding database..."
bun run db:seed 2>/dev/null || echo "⚠️  Database seeding skipped"

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Run 'bun run dev' to start both frontend and backend"
echo "   2. Backend API: http://localhost:3000"
echo "   3. Frontend: http://localhost:5173"
echo "   4. Database: postgresql://postgres:@localhost:5433/browser_pool"
echo "   5. Redis: redis://localhost:6380"
echo ""
