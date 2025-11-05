# Deployment Guide

This guide covers deploying Browser Pool SaaS to production.

## Prerequisites

- Node.js 18+ installed on server
- PostgreSQL database
- Domain name with SSL certificate
- (Optional) Docker for containerized deployment

## Environment Setup

1. Create production environment file:

```bash
cp .env.example .env.production
```

2. Update `.env.production` with production values:

```bash
NODE_ENV=production
PORT=3000
ORIGIN_URL=https://api.yourdomain.com

# Use strong random secrets
JWT_SECRET=$(openssl rand -hex 32)
API_KEY_PREFIX=bp_

# Production database
DATABASE_URL=postgresql://user:password@db-host:5432/browser_pool

# Configure based on your infrastructure
BROWSER_POOL_SIZE=10
BROWSER_IDLE_TIMEOUT=600000

# Set your Dodo Payments credentials
DODO_API_KEY=your-production-dodo-key
DODO_WEBHOOK_SECRET=your-production-webhook-secret
```

## Database Setup

1. Create production database:

```bash
createdb browser_pool_prod
```

2. Run migrations:

```bash
DATABASE_URL="your-production-db-url" npx prisma migrate deploy
```

3. Generate Prisma Client:

```bash
npx prisma generate
```

## Build for Production

```bash
# Install dependencies
npm ci --production=false

# Build TypeScript
npm run build

# Install Playwright browsers
npx playwright install --with-deps chromium
```

## Running in Production

### Option 1: Direct Node.js

```bash
NODE_ENV=production node dist/index.js
```

### Option 2: PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name browser-pool-saas

# Configure auto-restart on server reboot
pm2 startup
pm2 save

# Monitor logs
pm2 logs browser-pool-saas

# Monitor performance
pm2 monit
```

### Option 3: Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-slim

# Install dependencies for Playwright
RUN apt-get update && apt-get install -y \
    chromium \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --production=false

# Copy source
COPY . .

# Build
RUN npm run build
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Start
CMD ["node", "dist/index.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/browser_pool
      - PORT=3000
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=browser_pool
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

Build and run:

```bash
docker-compose up -d
```

## Nginx Reverse Proxy

Configure Nginx for SSL termination and load balancing:

```nginx
upstream browser_pool {
    server localhost:3000;
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://browser_pool;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout for screenshot operations
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
    }
}
```

## Creating Admin User

After deployment, create an admin user:

```bash
# Connect to your production database
psql $DATABASE_URL

# Update a user to be admin
UPDATE users SET is_admin = true WHERE email = 'admin@yourdomain.com';
```

Or use a migration script:

```typescript
// scripts/create-admin.ts
import { prisma } from './src/db'
import { hashPassword, generateApiKey, hashApiKey } from './src/auth'

async function createAdmin() {
  const email = process.argv[2]
  const password = process.argv[3]
  const name = process.argv[4] || 'Admin'

  if (!email || !password) {
    console.error('Usage: tsx scripts/create-admin.ts <email> <password> [name]')
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      plan: 'ENTERPRISE',
      isAdmin: true,
    },
  })

  const rawApiKey = generateApiKey()
  const hashedKey = await hashApiKey(rawApiKey)

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      key: hashedKey,
      name: 'Admin Key',
    },
  })

  console.log('Admin user created!')
  console.log('Email:', email)
  console.log('API Key:', rawApiKey)
  console.log('Store this API key securely!')

  await prisma.$disconnect()
}

createAdmin()
```

## Monitoring

### Health Checks

Set up health check monitoring:

```bash
# Basic health check
curl https://api.yourdomain.com/health

# Admin health check (detailed)
curl -H "X-API-Key: your-admin-key" https://api.yourdomain.com/admin/health
```

### Logging

Logs are written to:
- Console (stdout/stderr)
- File: `logs/app.log` (if configured)

For production, use a log aggregation service like:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog
- New Relic
- Papertrail

### Database Backups

Set up automated PostgreSQL backups:

```bash
# Create backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="browser_pool"

pg_dump $DATABASE_URL > "$BACKUP_DIR/${DB_NAME}_${DATE}.sql"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "${DB_NAME}_*.sql" -mtime +7 -delete
```

Add to crontab:

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup-script.sh
```

## Scaling

### Horizontal Scaling

For horizontal scaling:

1. **Use Redis for rate limiting** instead of in-memory Map
2. **Use a message queue** (RabbitMQ, Redis) for screenshot jobs
3. **Load balancer** to distribute traffic across instances
4. **Shared database** - single PostgreSQL instance or cluster

### Vertical Scaling

Adjust based on load:

```bash
# Increase browser pool size
BROWSER_POOL_SIZE=20

# Adjust Node.js memory
NODE_OPTIONS="--max-old-space-size=4096"
```

## Security Checklist

- [ ] Use strong, random secrets for JWT_SECRET
- [ ] Enable SSL/HTTPS
- [ ] Configure CORS properly
- [ ] Set up rate limiting at nginx level
- [ ] Keep dependencies updated
- [ ] Use environment variables for secrets
- [ ] Enable database SSL connections
- [ ] Set up firewall rules
- [ ] Use non-root user to run the app
- [ ] Implement request size limits
- [ ] Enable security headers
- [ ] Set up monitoring and alerts

## Dodo Payments Integration

### Setup Webhooks

1. Log into Dodo Payments dashboard
2. Go to Developers > Webhooks
3. Add webhook URL: `https://api.yourdomain.com/webhooks/dodo`
4. Select events: `payment.succeeded`, `payment.failed`, `subscription.updated`
5. Save the webhook secret to your environment

### Test Payment Flow

```bash
# Create a test subscription
curl -X POST https://api.yourdomain.com/subscriptions/create \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"plan": "PRO"}'
```

## Troubleshooting

### Issue: Playwright browsers not working

```bash
# Install system dependencies
npx playwright install-deps chromium
```

### Issue: Database connection errors

```bash
# Test connection
psql $DATABASE_URL

# Check Prisma migrations
npx prisma migrate status
```

### Issue: High memory usage

```bash
# Reduce browser pool size
BROWSER_POOL_SIZE=3

# Enable browser idle timeout
BROWSER_IDLE_TIMEOUT=300000  # 5 minutes
```

## Support

For deployment issues:
- Check logs: `pm2 logs browser-pool-saas`
- Database issues: Check PostgreSQL logs
- Browser issues: Check Playwright documentation
- Contact support: support@yourdomain.com
