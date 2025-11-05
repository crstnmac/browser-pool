# Security Remediation Plan - Browser Pool SaaS

**Project:** Browser Pool SaaS
**Date Created:** 2025-11-05
**Status:** Draft
**Total Issues:** 30 (4 Critical, 7 High, 11 Medium, 8 Low)

---

## Overview

This document provides a detailed, step-by-step implementation plan for fixing all 30 security issues identified in the security audit. Each fix includes:
- Implementation steps
- Code changes required
- Testing procedures
- Estimated effort
- Dependencies

---

## Phase 1: Critical Fixes (Priority 1)

### CRIT-01: Fix API Key Authentication Timing Attack

**Effort:** 8 hours | **Priority:** P0 - Critical

**Current Issue:** `src/auth.ts:58-101` loads all API keys and compares sequentially, leaking timing information.

**Implementation Steps:**

1. **Add key prefix to schema**

```prisma
// prisma/schema.prisma - Add to ApiKey model
model ApiKey {
  id          String    @id @default(cuid())
  userId      String
  key         String    @unique // Hash
  keyPrefix   String    @index // NEW: First 12 chars of raw key (e.g., "bp_live_1234")
  name        String
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime?
  revokedAt   DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  usageLogs UsageLog[]

  @@index([userId])
  @@index([keyPrefix]) // NEW: Index for fast lookup
}
```

2. **Run migration**

```bash
npx prisma migrate dev --name add_api_key_prefix
npx prisma generate
```

3. **Update generateApiKey and hashApiKey functions**

```typescript
// src/auth.ts - Update these functions

export function generateApiKey(): string {
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test'
  const prefix = process.env.API_KEY_PREFIX || 'bp_'
  const randomBytes = crypto.randomBytes(24).toString('hex')
  return `${prefix}${env}_${randomBytes}`
}

export function extractKeyPrefix(apiKey: string): string {
  // Extract first 12 characters for prefix matching
  return apiKey.substring(0, 12)
}
```

4. **Rewrite authenticateApiKey function**

```typescript
// src/auth.ts - Replace entire function

export async function authenticateApiKey(apiKey: string) {
  try {
    const keyPrefix = extractKeyPrefix(apiKey)

    // Direct lookup by prefix (constant time)
    const apiKeyRecords = await prisma.apiKey.findMany({
      where: {
        keyPrefix,
        revokedAt: null,
      },
      include: {
        user: true,
      },
    })

    // Should only be 0 or 1 result with unique prefix
    if (apiKeyRecords.length === 0) {
      return null
    }

    // Check each matching key (usually just 1)
    for (const key of apiKeyRecords) {
      const isValid = await verifyApiKey(apiKey, key.key)

      if (isValid) {
        // Check if user is active
        if (key.user.status !== 'ACTIVE') {
          logger.warn('API key used by inactive user', {
            userId: key.userId,
            userStatus: key.user.status,
          })
          return null
        }

        // Update last used timestamp (async, don't await)
        prisma.apiKey.update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        }).catch(err => logger.error('Failed to update lastUsedAt', err))

        return {
          apiKey: key,
          user: key.user,
        }
      }
    }

    return null
  } catch (error) {
    logger.error('Error authenticating API key:', error)
    return null
  }
}
```

5. **Update API key creation**

```typescript
// src/routes/users.ts - Update API key creation

usersRouter.post('/api-keys', authMiddleware, async (c) => {
  // ... existing validation ...

  const rawApiKey = generateApiKey()
  const hashedKey = await hashApiKey(rawApiKey)
  const keyPrefix = extractKeyPrefix(rawApiKey)

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: user.id,
      key: hashedKey,
      keyPrefix,  // NEW: Store prefix
      name: validation.data.name,
    },
  })

  // ... rest of code
})
```

6. **Data migration script**

```typescript
// scripts/migrate-api-key-prefixes.ts

import { prisma } from '../src/db.js'
import { generateApiKey, hashApiKey, extractKeyPrefix } from '../src/auth.js'

async function migrateApiKeyPrefixes() {
  console.log('Starting API key prefix migration...')

  // WARNING: This requires regenerating ALL API keys
  // Old keys will stop working. Users must get new keys.

  const users = await prisma.user.findMany({
    include: { apiKeys: true }
  })

  for (const user of users) {
    for (const apiKey of user.apiKeys) {
      // Generate new key
      const rawKey = generateApiKey()
      const hashedKey = await hashApiKey(rawKey)
      const keyPrefix = extractKeyPrefix(rawKey)

      // Update in database
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: {
          key: hashedKey,
          keyPrefix,
        }
      })

      console.log(`Updated API key for user ${user.email}`)
      console.log(`New key: ${rawKey}`)
      console.log('---')
    }
  }

  console.log('Migration complete. All users need new API keys.')
}

migrateApiKeyPrefixes()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

**Testing:**

```typescript
// __tests__/auth.test.ts

describe('API Key Authentication', () => {
  it('should not leak timing information', async () => {
    // Test with valid and invalid keys
    const timings = []

    for (let i = 0; i < 100; i++) {
      const start = process.hrtime.bigint()
      await authenticateApiKey('bp_live_invalid_key_' + i)
      const end = process.hrtime.bigint()
      timings.push(Number(end - start))
    }

    // Calculate standard deviation
    const mean = timings.reduce((a, b) => a + b) / timings.length
    const variance = timings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / timings.length
    const stdDev = Math.sqrt(variance)

    // Timing should be consistent (low standard deviation)
    expect(stdDev / mean).toBeLessThan(0.1) // Less than 10% variance
  })
})
```

---

### CRIT-02: Implement Redis-Based Rate Limiting

**Effort:** 12 hours | **Priority:** P0 - Critical

**Current Issue:** In-memory rate limiting won't work across multiple servers.

**Implementation Steps:**

1. **Install dependencies**

```bash
npm install ioredis @types/ioredis
```

2. **Create Redis client**

```typescript
// src/redis.ts - NEW FILE

import Redis from 'ioredis'
import { logger } from './logger.js'

let redis: Redis | null = null

export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      reconnectOnError(err) {
        logger.error('Redis connection error:', err)
        return true
      },
    })

    redis.on('connect', () => {
      logger.info('Redis connected')
    })

    redis.on('error', (err) => {
      logger.error('Redis error:', err)
    })
  }

  return redis
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit()
    redis = null
  }
}
```

3. **Rewrite rate limiting middleware**

```typescript
// src/middleware.ts - Replace rate limiting code

import { getRedisClient } from './redis.js'

export async function rateLimitMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const rateLimit = getRateLimitForPlan(user.plan)
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute window
  const currentWindow = Math.floor(now / windowMs)

  const key = `rate_limit:${user.id}:${currentWindow}`

  try {
    const redis = getRedisClient()

    // Increment counter
    const count = await redis.incr(key)

    // Set expiry on first increment
    if (count === 1) {
      await redis.expire(key, 60) // Expire after 60 seconds
    }

    // Check limit
    if (count > rateLimit) {
      const ttl = await redis.ttl(key)
      logger.warn('Rate limit exceeded', {
        userId: user.id,
        plan: user.plan,
        limit: rateLimit,
        count,
      })

      return c.json(
        {
          error: 'Rate limit exceeded',
          limit: rateLimit,
          resetIn: ttl,
        },
        429
      )
    }

    // Set rate limit headers
    c.header('X-RateLimit-Limit', rateLimit.toString())
    c.header('X-RateLimit-Remaining', (rateLimit - count).toString())
    c.header('X-RateLimit-Reset', new Date((currentWindow + 1) * windowMs).toISOString())

    await next()
  } catch (error) {
    logger.error('Rate limit check failed:', error)
    // Fail open (allow request) to prevent Redis outage from breaking the API
    await next()
  }
}
```

4. **Add IP-based rate limiting**

```typescript
// src/middleware.ts - Add new middleware

export async function ipRateLimitMiddleware(c: Context, next: Next) {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
             c.req.header('x-real-ip') ||
             'unknown'

  const limit = 1000 // 1000 requests per minute per IP
  const windowMs = 60 * 1000
  const currentWindow = Math.floor(Date.now() / windowMs)
  const key = `ip_rate_limit:${ip}:${currentWindow}`

  try {
    const redis = getRedisClient()
    const count = await redis.incr(key)

    if (count === 1) {
      await redis.expire(key, 60)
    }

    if (count > limit) {
      logger.warn('IP rate limit exceeded', { ip, count })
      return c.json({
        error: 'Too many requests from your IP. Please try again later.'
      }, 429)
    }

    await next()
  } catch (error) {
    logger.error('IP rate limit check failed:', error)
    await next() // Fail open
  }
}
```

5. **Apply to application**

```typescript
// src/index.ts - Add IP rate limiting globally

import { ipRateLimitMiddleware } from './middleware.js'

// Add after CORS, before routes
app.use('*', ipRateLimitMiddleware)

// Screenshot endpoint keeps both middlewares
app.post('/screenshot',
  authMiddleware,
  rateLimitMiddleware,  // User-based limit
  quotaMiddleware,
  async (c) => {
    // ... handler
  }
)
```

6. **Update shutdown handler**

```typescript
// src/index.ts - Update shutdown function

import { disconnectRedis } from './redis.js'

async function shutdown() {
  logger.info('Shutting down gracefully...')

  try {
    await browserPool.close()
    logger.info('Browser pool closed')

    await disconnectRedis()
    logger.info('Redis disconnected')

    await prisma.$disconnect()
    logger.info('Database disconnected')

    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown:', error)
    process.exit(1)
  }
}
```

7. **Update environment variables**

```bash
# .env
REDIS_URL=redis://localhost:6379

# For production with Redis cluster:
# REDIS_URL=redis://username:password@redis-host:6379/0
```

**Testing:**

```typescript
// __tests__/ratelimit.test.ts

describe('Distributed Rate Limiting', () => {
  it('should enforce rate limits across multiple instances', async () => {
    // Simulate multiple server instances
    const instance1 = createApp()
    const instance2 = createApp()

    const apiKey = 'test_key'
    const limit = 5 // FREE tier limit

    // Make 3 requests to instance1
    for (let i = 0; i < 3; i++) {
      const res = await instance1.request('/screenshot', {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
        body: JSON.stringify({ url: 'https://example.com' })
      })
      expect(res.status).not.toBe(429)
    }

    // Make 3 more to instance2 (should hit limit)
    for (let i = 0; i < 3; i++) {
      const res = await instance2.request('/screenshot', {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
        body: JSON.stringify({ url: 'https://example.com' })
      })

      if (i < 2) {
        expect(res.status).not.toBe(429)
      } else {
        expect(res.status).toBe(429) // 6th request should fail
      }
    }
  })
})
```

---

### CRIT-03: Fix CORS Configuration

**Effort:** 2 hours | **Priority:** P0 - Critical

**Current Issue:** CORS allows all origins (`*`) by default.

**Implementation Steps:**

1. **Update CORS configuration**

```typescript
// src/index.ts - Replace CORS configuration

import { cors } from 'hono/cors'

// Validate ORIGIN_URL on startup
const allowedOrigins = (process.env.ORIGIN_URL || '').split(',').map(o => o.trim()).filter(Boolean)

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  logger.error('ORIGIN_URL must be configured in production')
  throw new Error('ORIGIN_URL environment variable is required in production mode')
}

// Configure CORS
app.use('*', cors({
  origin: (origin) => {
    // Allow requests with no origin (e.g., mobile apps, Postman)
    if (!origin) return true

    // In development, allow localhost
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return true
      }
    }

    // Check against whitelist
    if (allowedOrigins.includes(origin)) {
      return true
    }

    // Check wildcard patterns (e.g., "*.example.com")
    const wildcards = allowedOrigins.filter(o => o.startsWith('*.'))
    for (const pattern of wildcards) {
      const domain = pattern.substring(2) // Remove "*."
      if (origin.endsWith(domain)) {
        return true
      }
    }

    logger.warn('CORS origin rejected', { origin })
    return false
  },
  credentials: true,
  maxAge: 600,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Request-ID'],
}))
```

2. **Update environment variables**

```bash
# .env.example - Update CORS documentation

# CORS Configuration
# Comma-separated list of allowed origins
# Use *.example.com for wildcard subdomains
ORIGIN_URL=https://app.browserpool.com,https://dashboard.browserpool.com

# Development example:
# ORIGIN_URL=http://localhost:3000,http://localhost:3001
```

3. **Add startup validation**

```typescript
// src/index.ts - Add at startup

function validateConfiguration() {
  const checks = []

  // Check ORIGIN_URL
  if (process.env.NODE_ENV === 'production' && !process.env.ORIGIN_URL) {
    checks.push('ORIGIN_URL must be set in production')
  }

  // Check JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET || ''
    if (jwtSecret.length < 32 || jwtSecret.includes('change-this')) {
      checks.push('JWT_SECRET must be changed in production')
    }
  }

  // Check DODO configuration
  if (!process.env.DODO_API_KEY || process.env.DODO_API_KEY.includes('your-')) {
    logger.warn('DODO_API_KEY not configured - payment features disabled')
  }

  if (checks.length > 0) {
    logger.error('Configuration validation failed:', checks)
    throw new Error(`Configuration errors: ${checks.join(', ')}`)
  }

  logger.info('Configuration validation passed')
}

validateConfiguration()
```

**Testing:**

```bash
# Test CORS with curl
curl -H "Origin: https://malicious.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-API-Key" \
     -X OPTIONS \
     http://localhost:3000/screenshot

# Should NOT include Access-Control-Allow-Origin header for unauthorized origin
```

---

### CRIT-04: Add Security Headers Middleware

**Effort:** 4 hours | **Priority:** P0 - Critical

**Current Issue:** No security headers are set, exposing application to various attacks.

**Implementation Steps:**

1. **Create security headers middleware**

```typescript
// src/middleware.ts - Add security headers

export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next()

  // Strict-Transport-Security
  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  // X-Frame-Options
  c.header('X-Frame-Options', 'DENY')

  // X-Content-Type-Options
  c.header('X-Content-Type-Options', 'nosniff')

  // X-XSS-Protection (for older browsers)
  c.header('X-XSS-Protection', '1; mode=block')

  // Referrer-Policy
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions-Policy
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')

  // Content-Security-Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  c.header('Content-Security-Policy', csp)
}
```

2. **Apply middleware**

```typescript
// src/index.ts - Add after CORS middleware

import { securityHeadersMiddleware } from './middleware.js'

app.use('*', securityHeadersMiddleware)
```

3. **Exclude CSP for screenshot endpoint** (binary response)

```typescript
// src/middleware.ts - Add bypass for binary endpoints

export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next()

  // Skip CSP for binary responses
  const contentType = c.res.headers.get('content-type') || ''
  const isBinary = contentType.includes('image/') ||
                   contentType.includes('application/octet-stream')

  // Always set these headers
  c.header('X-Frame-Options', 'DENY')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Only set CSP for non-binary responses
  if (!isBinary) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; ')

    c.header('Content-Security-Policy', csp)
  }

  // HSTS only in production
  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
}
```

**Testing:**

```bash
# Test security headers
curl -I http://localhost:3000/health

# Should include:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: ...
# etc.
```

---

### HIGH-02: Implement SSRF Protection

**Effort:** 6 hours | **Priority:** P1 - High

**Current Issue:** Screenshot endpoint accepts any URL, enabling SSRF attacks.

**Implementation Steps:**

1. **Create URL validation utility**

```typescript
// src/utils/urlValidator.ts - NEW FILE

import { URL } from 'url'
import dns from 'dns/promises'
import { logger } from '../logger.js'

export interface URLValidationResult {
  allowed: boolean
  reason?: string
}

/**
 * Check if URL is safe to fetch
 */
export async function isAllowedURL(urlString: string): Promise<URLValidationResult> {
  try {
    const url = new URL(urlString)

    // 1. Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        allowed: false,
        reason: 'Only HTTP and HTTPS protocols are allowed'
      }
    }

    // 2. Block private/internal IP ranges in hostname
    const hostname = url.hostname

    // Block localhost variants
    if (/^(localhost|127\.|::1|0\.0\.0\.0)$/i.test(hostname)) {
      return {
        allowed: false,
        reason: 'Localhost addresses are not allowed'
      }
    }

    // Block private IPv4 ranges
    const privateIPv4Ranges = [
      /^10\./,                          // 10.0.0.0/8
      /^172\.(1[6-9]|2\d|3[01])\./,    // 172.16.0.0/12
      /^192\.168\./,                    // 192.168.0.0/16
      /^169\.254\./,                    // 169.254.0.0/16 (link-local)
      /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, // 100.64.0.0/10 (CGNAT)
    ]

    if (privateIPv4Ranges.some(range => range.test(hostname))) {
      return {
        allowed: false,
        reason: 'Private IP addresses are not allowed'
      }
    }

    // Block private IPv6 ranges
    const privateIPv6Ranges = [
      /^fe80:/i,  // Link-local
      /^fc00:/i,  // Private
      /^fd00:/i,  // Private
    ]

    if (privateIPv6Ranges.some(range => range.test(hostname))) {
      return {
        allowed: false,
        reason: 'Private IPv6 addresses are not allowed'
      }
    }

    // 3. Block cloud metadata endpoints
    const blockedHosts = [
      'metadata.google.internal',
      '169.254.169.254',
      'fd00:ec2::254', // AWS IPv6
    ]

    if (blockedHosts.includes(hostname.toLowerCase())) {
      return {
        allowed: false,
        reason: 'Access to cloud metadata services is not allowed'
      }
    }

    // 4. Resolve DNS and check if it points to private IP
    try {
      const addresses = await dns.resolve4(hostname).catch(() => [])

      for (const addr of addresses) {
        if (privateIPv4Ranges.some(range => range.test(addr))) {
          logger.warn('DNS resolved to private IP', { hostname, resolved: addr })
          return {
            allowed: false,
            reason: 'Domain resolves to private IP address'
          }
        }
      }
    } catch (error) {
      // DNS resolution failed - could be IPv6 only or DNS error
      logger.warn('DNS resolution failed', { hostname, error })
    }

    // 5. Check for suspicious patterns
    const suspiciousPatterns = [
      /\d+\.\d+\.\d+\.\d+.*@/, // URL with embedded IP (e.g., http://attacker@192.168.1.1)
      /@.*\d+\.\d+\.\d+\.\d+/, // IP after @ symbol
    ]

    if (suspiciousPatterns.some(pattern => pattern.test(urlString))) {
      return {
        allowed: false,
        reason: 'Suspicious URL pattern detected'
      }
    }

    return { allowed: true }
  } catch (error: any) {
    return {
      allowed: false,
      reason: `Invalid URL format: ${error.message}`
    }
  }
}

/**
 * Validate and sanitize URL
 */
export function sanitizeURL(urlString: string): string {
  try {
    const url = new URL(urlString)

    // Remove credentials from URL
    url.username = ''
    url.password = ''

    // Normalize
    return url.toString()
  } catch {
    throw new Error('Invalid URL')
  }
}
```

2. **Apply to screenshot endpoint**

```typescript
// src/index.ts - Update screenshot endpoint

import { isAllowedURL, sanitizeURL } from './utils/urlValidator.js'

app.post('/screenshot',
  authMiddleware,
  rateLimitMiddleware,
  quotaMiddleware,
  async (c) => {
    const startTime = Date.now()
    const user = c.get('user')
    const apiKey = c.get('apiKey')
    let statusCode = 200
    let errorMessage: string | undefined

    const { url, cookieConsent = true } = await c.req.json()

    if (!url) {
      return c.json({ error: 'URL is required' }, 400)
    }

    // Validate URL safety
    const validation = await isAllowedURL(url)
    if (!validation.allowed) {
      logger.warn('Rejected unsafe URL', {
        userId: user.id,
        url,
        reason: validation.reason
      })

      return c.json({
        error: 'Invalid URL',
        reason: validation.reason
      }, 400)
    }

    // Sanitize URL
    const safeURL = sanitizeURL(url)

    let page
    try {
      page = await browserPool.requirePage()

      await page.context().clearCookies()

      // Use sanitized URL
      await page.goto(safeURL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      })

      // ... rest of handler
    } catch (error: any) {
      // ... error handling
    }
  }
)
```

3. **Add to admin routes**

```typescript
// src/routes/admin.ts - For any admin URL testing

import { isAllowedURL } from '../utils/urlValidator.js'

// If admin can test URLs, validate them too
adminRouter.post('/test-url', authMiddleware, adminMiddleware, async (c) => {
  const { url } = await c.req.json()

  const validation = await isAllowedURL(url)

  return c.json({
    safe: validation.allowed,
    reason: validation.reason
  })
})
```

**Testing:**

```typescript
// __tests__/urlValidator.test.ts

describe('URL Validation', () => {
  it('should block localhost', async () => {
    const result = await isAllowedURL('http://localhost/admin')
    expect(result.allowed).toBe(false)
  })

  it('should block private IPs', async () => {
    const tests = [
      'http://192.168.1.1',
      'http://10.0.0.1',
      'http://172.16.0.1',
      'http://169.254.169.254/latest/meta-data',
    ]

    for (const url of tests) {
      const result = await isAllowedURL(url)
      expect(result.allowed).toBe(false)
    }
  })

  it('should allow public URLs', async () => {
    const tests = [
      'https://example.com',
      'https://google.com',
      'http://3.4.5.6', // Public IP
    ]

    for (const url of tests) {
      const result = await isAllowedURL(url)
      expect(result.allowed).toBe(true)
    }
  })

  it('should block DNS rebinding', async () => {
    // Mock DNS to return private IP
    jest.spyOn(dns, 'resolve4').mockResolvedValue(['192.168.1.1'])

    const result = await isAllowedURL('http://evil.com')
    expect(result.allowed).toBe(false)
  })
})
```

---

## Phase 2: High-Priority Fixes

### HIGH-01: Add Authentication Rate Limiting

**Effort:** 4 hours | **Priority:** P1 - High

**Implementation:**

```typescript
// src/middleware.ts - Add IP-based auth rate limiter

import { getRedisClient } from './redis.js'

export async function authRateLimitMiddleware(c: Context, next: Next) {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const endpoint = c.req.path

  const limit = 10 // 10 auth attempts per IP per 15 minutes
  const windowMs = 15 * 60 * 1000
  const currentWindow = Math.floor(Date.now() / windowMs)
  const key = `auth_rate_limit:${ip}:${endpoint}:${currentWindow}`

  try {
    const redis = getRedisClient()
    const count = await redis.incr(key)

    if (count === 1) {
      await redis.expire(key, 15 * 60) // 15 minutes
    }

    if (count > limit) {
      logger.warn('Auth rate limit exceeded', { ip, endpoint, count })

      return c.json({
        error: 'Too many authentication attempts. Please try again later.',
        retryAfter: await redis.ttl(key)
      }, 429)
    }

    await next()
  } catch (error) {
    logger.error('Auth rate limit check failed:', error)
    await next() // Fail open
  }
}
```

Apply to auth routes:

```typescript
// src/routes/auth.ts

import { authRateLimitMiddleware } from '../middleware.js'

const authRouter = new Hono()

// Apply to all auth routes
authRouter.use('*', authRateLimitMiddleware)

// ... rest of routes
```

---

### HIGH-03: Implement Account Lockout

**Effort:** 6 hours | **Priority:** P1 - High

**Implementation:**

1. **Update schema**

```prisma
// prisma/schema.prisma - Add to User model

model User {
  // ... existing fields

  failedLoginAttempts Int       @default(0)
  lockedUntil         DateTime?

  // ... rest of model
}
```

2. **Run migration**

```bash
npx prisma migrate dev --name add_account_lockout
```

3. **Create account lock utility**

```typescript
// src/utils/accountLock.ts - NEW FILE

import { prisma } from '../db.js'
import { logger } from '../logger.js'
import { logAudit } from '../audit.js'

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

export async function checkAccountLock(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true }
  })

  if (!user?.lockedUntil) return false

  // Check if still locked
  if (user.lockedUntil > new Date()) {
    return true
  }

  // Lock expired, clear it
  await prisma.user.update({
    where: { id: userId },
    data: {
      lockedUntil: null,
      failedLoginAttempts: 0
    }
  })

  return false
}

export async function recordFailedLogin(userId: string, ip?: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, email: true }
  })

  if (!user) return

  const attempts = user.failedLoginAttempts + 1
  const shouldLock = attempts >= MAX_ATTEMPTS

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: attempts,
      ...(shouldLock ? {
        lockedUntil: new Date(Date.now() + LOCK_DURATION_MS)
      } : {})
    }
  })

  if (shouldLock) {
    logger.warn('Account locked due to failed login attempts', {
      userId,
      email: user.email,
      attempts
    })

    await logAudit({
      userId,
      action: 'account.locked',
      resource: 'user',
      resourceId: userId,
      details: { reason: 'too_many_failed_logins', attempts },
      ipAddress: ip
    })
  }
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date()
    }
  })
}
```

4. **Update login route**

```typescript
// src/routes/auth.ts - Update login handler

import { checkAccountLock, recordFailedLogin, recordSuccessfulLogin } from '../utils/accountLock.js'

authRouter.post('/login', async (c) => {
  const body = await c.req.json()
  const validation = loginSchema.safeParse(body)

  if (!validation.success) {
    return c.json({ error: 'Validation failed', details: validation.error.issues }, 400)
  }

  const { email, password } = validation.data
  const ip = c.req.header('x-forwarded-for')

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    // Constant-time fake password check
    await verifyPassword(password, '$2b$10$dummyhashdummyhashdummyhashdummyhashdummyhash123456')
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Check if account is locked
  const isLocked = await checkAccountLock(user.id)
  if (isLocked) {
    logger.warn('Login attempt on locked account', { userId: user.id, email })
    return c.json({
      error: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
    }, 403)
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash)

  if (!isValid) {
    await recordFailedLogin(user.id, ip)
    await logAudit({
      userId: user.id,
      action: 'user.login_failed',
      resource: 'user',
      resourceId: user.id,
      details: { reason: 'Invalid password' },
      ipAddress: ip,
      userAgent: c.req.header('user-agent')
    })
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Check user status
  if (user.status !== 'ACTIVE') {
    return c.json({ error: 'Account is suspended or deleted' }, 403)
  }

  // Successful login - reset attempts
  await recordSuccessfulLogin(user.id)

  // ... rest of successful login logic
})
```

---

## Phase 3 & 4: Medium and Low Priority Fixes

*See SECURITY_AUDIT.md for detailed descriptions of remaining issues.*

**Implementation timeline:**
- MED-01 to MED-11: Weeks 5-6
- LOW-01 to LOW-08: Weeks 7-8

Each can be implemented incrementally as separate PRs.

---

## Deployment Checklist

### Pre-Deployment

- [ ] All critical issues fixed
- [ ] Redis instance deployed and tested
- [ ] Environment variables updated
- [ ] Database migrations applied
- [ ] All tests passing
- [ ] Security headers tested
- [ ] CORS configuration tested
- [ ] Rate limiting tested

### Post-Deployment

- [ ] Monitor error rates
- [ ] Check Redis connection health
- [ ] Verify rate limiting working
- [ ] Check security headers in production
- [ ] Monitor for SSRF attempts
- [ ] Review audit logs for suspicious activity

### Rollback Plan

If critical issues arise:
1. Revert to previous version
2. Disable Redis rate limiting (fallback to in-memory)
3. Widen CORS temporarily if needed
4. Document issues for analysis

---

## Testing Strategy

### Unit Tests
- API key authentication timing
- URL validation (SSRF protection)
- Rate limiting logic
- Account lockout mechanism

### Integration Tests
- Multi-instance rate limiting with Redis
- CORS with various origins
- Security headers on all endpoints
- Failed login flow

### Security Tests
- Penetration testing for SSRF
- Rate limit bypass attempts
- Timing attack tests
- Account enumeration tests

### Load Tests
- Redis rate limiter under load
- Database connection pool limits
- Browser pool under stress
- API response times

---

## Monitoring

### Key Metrics

1. **Security Events**
   - Failed authentication attempts
   - Rate limit violations
   - SSRF attempts blocked
   - Account lockouts

2. **Performance Metrics**
   - Redis latency
   - API response times
   - Error rates
   - Browser pool utilization

3. **Health Checks**
   - Redis connection status
   - Database connection pool
   - Browser pool availability

---

## Documentation Updates

After implementation:

1. **Update API.md**
   - Document rate limiting headers
   - Document CORS requirements
   - Add security best practices

2. **Update DEPLOYMENT.md**
   - Add Redis deployment steps
   - Add environment variable requirements
   - Add security configuration checklist

3. **Create SECURITY.md**
   - Responsible disclosure policy
   - Security best practices for users
   - Known limitations

---

## Questions & Support

For questions about implementing these fixes:

1. Review individual issue descriptions in SECURITY_AUDIT.md
2. Check implementation examples in this document
3. Consult with security team before deploying to production

**Next Steps:**
1. Review and approve this remediation plan
2. Begin Phase 1 implementation
3. Schedule security review after Phase 1 completion

---

**Last Updated:** 2025-11-05
