#!/bin/bash
set -e

echo "🔄 Starting Browser Pool development environment..."

# Track service readiness
POSTGRES_READY=false
REDIS_READY=false

# Check database connection
echo "🔗 Checking database connection..."
MAX_ATTEMPTS=10
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if pg_isready -h postgres -p 5432 -U postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
    POSTGRES_READY=true
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⚠️  PostgreSQL is not ready yet (waited ${MAX_ATTEMPTS}s)"
    echo "ℹ️  Services may still be starting up..."
    break
  fi
  sleep 1
done

# Check Redis connection
echo "🔗 Checking Redis connection..."
MAX_ATTEMPTS=10
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if redis-cli -h redis -p 6379 ping 2>/dev/null | grep -q PONG; then
    echo "✅ Redis is ready"
    REDIS_READY=true
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⚠️  Redis is not ready yet (waited ${MAX_ATTEMPTS}s)"
    echo "ℹ️  Services may still be starting up..."
    break
  fi
  sleep 1
done

# Report overall status
if [ "$POSTGRES_READY" = true ] && [ "$REDIS_READY" = true ]; then
  echo "✅ All services are ready!"
else
  echo "⚠️  Some services are not ready yet"
  [ "$POSTGRES_READY" = false ] && echo "   - PostgreSQL: not ready"
  [ "$REDIS_READY" = false ] && echo "   - Redis: not ready"
fi
echo ""
echo "💡 Tip: Run 'bun run dev' to start development servers"
echo ""
