#!/bin/bash

echo "🚀 Setting up Browser Pool development environment..."

# Copy .env from example if it doesn't exist
if [ ! -f /workspaces/browser-pool/.env ]; then
  echo "📋 Creating .env from .env.example..."
  cp /workspaces/browser-pool/.env.example /workspaces/browser-pool/.env
fi

# Source the environment variables
set -a
source /workspaces/browser-pool/.env
set +a

# Default connection info for compose services if not provided
export PGHOST=${PGHOST:-postgres}
export PGUSER=${PGUSER:-postgres}
export PGPASSWORD=${PGPASSWORD:-postgres}
export PGDATABASE=${PGDATABASE:-browser_pool}

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
for i in {1..30}; do
  if psql -U "$PGUSER" -h "$PGHOST" -c "SELECT 1" > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️  PostgreSQL did not become ready in time"
    exit 1
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
echo "   4. Database: postgresql://postgres:@localhost:5432/browser_pool"
echo "   5. Redis: redis://localhost:6379"
echo ""
