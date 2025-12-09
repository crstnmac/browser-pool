#!/bin/bash
set -e

echo "🔄 Starting Browser Pool development environment..."

# Check database connection
echo "🔗 Checking database connection..."
pg_isready -h postgres -p 5432 -U postgres || {
    echo "⚠️  PostgreSQL is not ready yet, please wait..."
    sleep 5
}

# Check Redis connection
echo "🔗 Checking Redis connection..."
redis-cli -h redis ping > /dev/null || {
    echo "⚠️  Redis is not ready yet, please wait..."
    sleep 5
}

echo "✅ All services are ready!"
echo ""
echo "💡 Tip: Run 'bun run dev' to start development servers"
echo ""
