# Browser Pool SaaS

A production-ready Screenshot-as-a-Service platform with intelligent cookie consent handling, built for developers.

## Features

- 🚀 **Fast & Reliable** - Efficient browser pool management
- 🔐 **Secure Authentication** - API key-based auth with bcrypt hashing
- 📊 **Usage Analytics** - Track requests, quotas, and performance
- 💰 **Subscription Plans** - Free, Pro, and Enterprise tiers
- ⚡ **Rate Limiting** - Per-plan rate limits with quota management
- 🪝 **Webhooks** - Real-time event notifications
- 🛡️ **Admin Dashboard** - User management and system analytics
- 🍪 **Smart Cookie Handling** - Automatic cookie consent banner detection
- 📈 **Scalable** - Built for horizontal scaling

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Playwright browsers

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd browser-pool
```

2. Install dependencies:
```bash
npm install
npx playwright install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create PostgreSQL database
createdb browser_pool

# Run migrations
npx prisma migrate dev

# (Optional) Seed with sample data
npx prisma db seed
```

5. Start the development server:
```bash
npm run dev
```

## Subscription Plans

### Free Tier
- 100 screenshots/month
- 5 requests/minute
- Standard support
- Basic features

### Pro Tier - $29/month
- 5,000 screenshots/month
- 30 requests/minute
- Priority support
- Webhook notifications

### Enterprise Tier - $299/month
- 100,000 screenshots/month
- 100 requests/minute
- Dedicated support
- Custom features
- SLA guarantee

## API Documentation

Full API documentation is available in [docs/API.md](docs/API.md).

### Quick Example

```bash
# Register a new user
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepass123",
    "name": "John Doe"
  }'

# Take a screenshot
curl -X POST http://localhost:3000/screenshot \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' \
  -o screenshot.png
```

## Architecture

See [docs/SAAS_ARCHITECTURE.md](docs/SAAS_ARCHITECTURE.md) for detailed architecture documentation.

### Tech Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Hono (lightweight & fast)
- **Database**: PostgreSQL with Prisma ORM
- **Browser Automation**: Playwright
- **Authentication**: API key-based with bcrypt
- **Logging**: Winston
- **Payments**: Dodo Payments integration

## Environment Variables

```bash
# Application
NODE_ENV=development
PORT=3000
ORIGIN_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/browser_pool

# Authentication
JWT_SECRET=your-secret-key
API_KEY_PREFIX=bp_

# Rate Limiting (requests per minute)
RATE_LIMIT_FREE=5
RATE_LIMIT_PRO=30
RATE_LIMIT_ENTERPRISE=100

# Quotas (requests per month)
QUOTA_FREE=100
QUOTA_PRO=5000
QUOTA_ENTERPRISE=100000

# Dodo Payments
DODO_API_KEY=your-dodo-api-key
DODO_WEBHOOK_SECRET=your-dodo-webhook-secret

# Browser Pool
BROWSER_POOL_SIZE=5
BROWSER_IDLE_TIMEOUT=300000