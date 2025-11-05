# SaaS Architecture Plan

## Overview
Converting Browser Pool into a multi-tenant SaaS platform for screenshot-as-a-service.

## Technology Stack
- **Runtime**: Node.js with TypeScript
- **Web Framework**: Hono
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Browser Automation**: Playwright
- **Authentication**: API Key-based
- **Logging**: Winston

## Database Schema

### Users Table
- id (UUID)
- email (unique)
- password_hash
- name
- plan (FREE, PRO, ENTERPRISE)
- status (ACTIVE, SUSPENDED, DELETED)
- created_at
- updated_at

### API Keys Table
- id (UUID)
- user_id (FK to Users)
- key (unique, hashed)
- name (user-defined label)
- last_used_at
- created_at
- revoked_at (nullable)

### Usage Logs Table
- id (UUID)
- api_key_id (FK to API Keys)
- user_id (FK to Users)
- endpoint
- url_requested
- status_code
- response_time_ms
- error_message (nullable)
- created_at

### Quotas Table
- id (UUID)
- user_id (FK to Users)
- period_start
- period_end
- requests_made
- requests_limit
- created_at

## Subscription Plans

### Free Tier
- 100 screenshots/month
- 5 requests/minute
- Standard support
- Basic features

### Pro Tier ($29/month)
- 5,000 screenshots/month
- 30 requests/minute
- Priority support
- Advanced cookie handling
- Webhook notifications

### Enterprise Tier ($299/month)
- 100,000 screenshots/month
- 100 requests/minute
- Dedicated support
- Custom features
- SLA guarantee

## API Endpoints

### Public Endpoints (No Auth)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user
- `GET /health` - Health check

### Authenticated Endpoints (API Key Required)
- `POST /screenshot` - Take screenshot
- `GET /usage` - Get current usage stats
- `GET /api-keys` - List user's API keys
- `POST /api-keys` - Create new API key
- `DELETE /api-keys/:id` - Revoke API key

### Admin Endpoints (Admin API Key Required)
- `GET /admin/users` - List all users
- `GET /admin/users/:id` - Get user details
- `PATCH /admin/users/:id` - Update user
- `GET /admin/analytics` - System-wide analytics
- `GET /admin/health` - Detailed health metrics

## Security Features
1. API key hashing (bcrypt)
2. Rate limiting per API key
3. Input validation and sanitization
4. CORS configuration
5. Request size limits
6. IP-based rate limiting (optional)

## Monitoring & Analytics
- Request success/failure rates
- Average response times
- Popular URLs requested
- User growth metrics
- Resource utilization

## Scalability Considerations
1. Database connection pooling
2. Browser pool per user/plan tier
3. Horizontal scaling support
4. CDN for static assets
5. Queue system for high-volume requests (future)

## Implementation Phases
1. ✅ Phase 1: Database setup and Prisma integration
2. ✅ Phase 2: Authentication and API key management
3. ✅ Phase 3: Rate limiting and usage tracking
4. ✅ Phase 4: Subscription management
5. ✅ Phase 5: Admin dashboard
6. ✅ Phase 6: Production deployment config
