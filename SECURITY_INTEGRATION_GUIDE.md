# Security Integration Guide

**Status:** Part 1 Complete | Part 2 Integration Needed
**Date:** 2025-11-13

This guide explains how to integrate the security fixes from Part 1 into your application routes and complete the security implementation.

---

## 🎯 What's Been Done (Part 1)

✅ All security utilities and middleware are implemented and ready to use:
- Redis client (`src/redis.ts`)
- URL validator for SSRF protection (`src/utils/urlValidator.ts`)
- Account lockout utility (`src/utils/accountLock.ts`)
- Log sanitization (`src/utils/sanitize.ts`)
- Complete middleware suite (`src/middleware.ts`)
- Database schema updated
- Migration script created

---

## 📋 Integration Checklist (Part 2)

### 1. Update `src/routes/auth.ts`

**Add imports:**
```typescript
import { checkAccountLock, recordFailedLogin, recordSuccessfulLogin } from '../utils/accountLock.js'
import { authRateLimitMiddleware } from '../middleware.js'
import { extractKeyPrefix } from '../auth.js'
```

**Apply rate limiting:**
```typescript
const authRouter = new Hono()

// Apply auth rate limiting to all auth routes
authRouter.use('*', authRateLimitMiddleware)
```

**Update password validation:**
```typescript
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'), // NEW: max length
  name: z.string().min(1, 'Name is required'),
})
```

**Update registration to include keyPrefix:**
```typescript
// In register handler, after generating API key:
const rawApiKey = generateApiKey()
const hashedKey = await hashApiKey(rawApiKey)
const keyPrefix = extractKeyPrefix(rawApiKey)  // NEW

const apiKey = await prisma.apiKey.create({
  data: {
    userId: user.id,
    key: hashedKey,
    keyPrefix,  // NEW
    name: 'Default Key',
  },
})
```

**Update login handler with account lockout:**
```typescript
authRouter.post('/login', async (c) => {
  // ... validation ...

  const { email, password } = validation.data
  const ip = c.req.header('x-forwarded-for')

  const user = await prisma.user.findUnique({ where: { email } })

  // SECURITY FIX: Constant-time password check to prevent email enumeration
  const dummyHash = '$2b$10$dummyhashdummyhashdummyhashdummyhashdummyhash123456'
  const passwordHash = user?.passwordHash || dummyHash

  const isValid = await verifyPassword(password, passwordHash)

  if (!user || !isValid) {
    if (user) {
      await recordFailedLogin(user.id, ip, c.req.header('user-agent'))
    }

    await logAudit({
      userId: user?.id,
      action: 'user.login_failed',
      resource: 'user',
      resourceId: user?.id,
      details: { reason: 'Invalid credentials' },
      ipAddress: ip,
      userAgent: c.req.header('user-agent')
    })

    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // SECURITY FIX: Check account lockout
  const isLocked = await checkAccountLock(user.id)
  if (isLocked) {
    logger.warn('Login attempt on locked account', { userId: user.id, email })
    return c.json({
      error: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
    }, 403)
  }

  // Check user status
  if (user.status !== 'ACTIVE') {
    return c.json({ error: 'Account is suspended or deleted' }, 403)
  }

  // SECURITY FIX: Record successful login (resets failed attempts)
  await recordSuccessfulLogin(user.id)

  // ... rest of login logic
})
```

---

### 2. Update `src/routes/users.ts`

**Add keyPrefix when creating API keys:**
```typescript
import { extractKeyPrefix } from '../auth.js'

// In POST /users/api-keys handler:
const rawApiKey = generateApiKey()
const hashedKey = await hashApiKey(rawApiKey)
const keyPrefix = extractKeyPrefix(rawApiKey)  // NEW

const apiKey = await prisma.apiKey.create({
  data: {
    userId: user.id,
    key: hashedKey,
    keyPrefix,  // NEW
    name: validation.data.name,
    // Optional: Set expiration
    // expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
  },
})
```

---

### 3. Update `src/routes/account.ts`

**Add password reset rate limiting:**
```typescript
import { authRateLimitMiddleware } from '../middleware.js'

// Apply to password reset endpoints
accountRouter.post('/request-password-reset', authRateLimitMiddleware, async (c) => {
  // ... existing logic
})
```

**Add password length validation:**
```typescript
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),  // NEW
})
```

**Fix password reset token reuse:**
```typescript
accountRouter.post('/reset-password', async (c) => {
  // ... validation ...

  // Find user with valid reset token
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiry: { gt: new Date() },
      passwordResetUsedAt: null,  // NEW: Ensure not already used
    },
  })

  if (!user) {
    return c.json({ error: 'Invalid or expired reset token' }, 400)
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword)

  // Update user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
      passwordResetUsedAt: new Date(),  // NEW: Mark token as used
    },
  })

  // ... rest of logic
})
```

**Complete GDPR deletion:**
```typescript
import { dodoPayments } from '../dodo.js'

accountRouter.delete('/', authMiddleware, async (c) => {
  // ... existing validation and subscription finding ...

  // SECURITY FIX: Actually cancel subscriptions in Dodo
  for (const sub of activeSubscriptions) {
    try {
      await dodoPayments.cancelSubscription(sub.dodoSubscriptionId, false)
      logger.info('Subscription canceled during account deletion', {
        userId: user.id,
        subscriptionId: sub.id
      })
    } catch (error) {
      logger.error('Failed to cancel subscription during deletion', {
        userId: user.id,
        subscriptionId: sub.id,
        error
      })
      // Continue with deletion even if cancellation fails
      // but alert admin for manual review
    }
  }

  // ... rest of deletion logic
})
```

---

### 4. Update `src/index.ts`

**Add imports:**
```typescript
import { getRedisClient, disconnectRedis, pingRedis } from './redis.js'
import {
  ipRateLimitMiddleware,
  securityHeadersMiddleware,
  httpsEnforcementMiddleware,
  requestTimeoutMiddleware,
  bodySizeLimitMiddleware,
} from './middleware.js'
import { isAllowedURL, sanitizeURL } from './utils/urlValidator.js'
```

**Apply global middleware (IMPORTANT ORDER):**
```typescript
const app = new Hono()

// 1. Error handler
app.onError(errorHandler)

// 2. Request ID (must be first)
app.use('*', requestIdMiddleware)

// 3. HTTPS enforcement (production only)
app.use('*', httpsEnforcementMiddleware)

// 4. Security headers
app.use('*', securityHeadersMiddleware)

// 5. Logging
app.use('*', honoLogger())

// 6. CORS - WITH VALIDATION
const allowedOrigins = (process.env.ORIGIN_URL || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  logger.error('ORIGIN_URL must be configured in production')
  throw new Error('ORIGIN_URL environment variable is required in production mode')
}

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return true  // Allow requests with no origin

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

    // Check wildcard patterns
    const wildcards = allowedOrigins.filter(o => o.startsWith('*.'))
    for (const pattern of wildcards) {
      const domain = pattern.substring(2)
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

// 7. IP-based rate limiting (global DoS protection)
app.use('*', ipRateLimitMiddleware)

// 8. Body size limit
app.use('*', bodySizeLimitMiddleware)

// 9. Request timeout
app.use('*', requestTimeoutMiddleware)
```

**Add SSRF protection to screenshot endpoint:**
```typescript
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

    // SECURITY FIX: Validate URL to prevent SSRF
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

    // SECURITY FIX: Sanitize URL
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

      // ... rest of screenshot logic
    } catch (error: any) {
      // ... error handling
    } finally {
      if (page) {
        await browserPool.releasePage(page)
      }
    }
  }
)
```

**Add startup configuration validation:**
```typescript
function validateConfiguration() {
  const errors = []

  // Check ORIGIN_URL in production
  if (process.env.NODE_ENV === 'production' && !process.env.ORIGIN_URL) {
    errors.push('ORIGIN_URL must be set in production')
  }

  // Check JWT_SECRET
  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET || ''
    if (jwtSecret.length < 32 || jwtSecret.includes('change-this')) {
      errors.push('JWT_SECRET must be a strong random string (32+ characters) in production')
    }
  }

  // Check Redis connection
  if (process.env.REDIS_URL) {
    logger.info('Redis URL configured, testing connection...')
    // Connection will be tested on first use
  } else {
    logger.warn('Redis not configured - using in-memory rate limiting (NOT recommended for production)')
  }

  if (errors.length > 0) {
    logger.error('Configuration validation failed', { errors })
    throw new Error(`Configuration errors:\n- ${errors.join('\n- ')}`)
  }

  logger.info('✅ Configuration validation passed')
}

// Call before starting server
validateConfiguration()
```

**Improve health check:**
```typescript
app.get('/health', async (c) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'ok',
      redis: 'ok',
      browserPool: 'ok',
    }
  }

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    health.status = 'degraded'
    health.checks.database = 'error'
  }

  // Check Redis
  try {
    const redisOk = await pingRedis()
    if (!redisOk) {
      health.checks.redis = 'not_connected'
    }
  } catch (error) {
    health.checks.redis = 'error'
  }

  // Check browser pool
  try {
    // Add a getStats() method to BrowserPool if needed
    // const stats = browserPool.getStats()
    // if (stats.available === 0) health.checks.browserPool = 'degraded'
  } catch (error) {
    health.checks.browserPool = 'error'
  }

  return c.json(health, health.status === 'ok' ? 200 : 503)
})
```

**Update shutdown handler:**
```typescript
async function shutdown() {
  logger.info('Shutting down gracefully...')

  try {
    await browserPool.close()
    logger.info('Browser pool closed')

    await disconnectRedis()  // NEW
    logger.info('Redis disconnected')

    await prisma.$disconnect()
    logger.info('Database disconnected')

    logger.info('Shutdown complete')
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown:', error)
    process.exit(1)
  }
}
```

---

## 🔄 Database Migration

### Step 1: Generate Migration
```bash
npx prisma migrate dev --name add_security_fields
```

### Step 2: Run Security Migration Script
```bash
# Option 1: Manual key regeneration (recommended)
tsx scripts/migrate-security-fields.ts

# Option 2: Auto-generate new keys
AUTO_GENERATE_NEW_KEYS=true tsx scripts/migrate-security-fields.ts

# Option 3: Revoke old keys
REVOKE_OLD_KEYS=true tsx scripts/migrate-security-fields.ts
```

---

## ✅ Testing Checklist

After integration, test:

- [ ] **Authentication**
  - Register new user (keyPrefix should be set)
  - Login with correct credentials
  - Login with wrong password (should increment failed attempts)
  - Login 5+ times with wrong password (should lock account)
  - Wait 15 minutes, try again (should unlock)

- [ ] **Rate Limiting**
  - Make 6 requests as FREE user in 1 minute (should get 429)
  - Make requests from same IP rapidly (should hit IP limit)
  - Try auth endpoints 10+ times (should hit auth rate limit)

- [ ] **SSRF Protection**
  - Try screenshot of `http://localhost` (should reject)
  - Try screenshot of `http://192.168.1.1` (should reject)
  - Try screenshot of `http://169.254.169.254` (should reject)
  - Try screenshot of valid public URL (should work)

- [ ] **Security Headers**
  - Check response headers for X-Frame-Options, CSP, etc.
  - Verify HSTS in production

- [ ] **CORS**
  - Request from allowed origin (should work)
  - Request from disallowed origin (should reject)

- [ ] **HTTPS**
  - In production, HTTP request should redirect to HTTPS

---

## 📊 Monitoring

After deployment, monitor:

1. **Redis Connection**: Check logs for "Redis connected" message
2. **Rate Limit Events**: Watch for "Rate limit exceeded" warnings
3. **Account Lockouts**: Monitor "Account locked" events
4. **SSRF Attempts**: Watch for "Rejected unsafe URL" warnings
5. **Failed Logins**: Track failed login patterns

---

## 🚨 Rollback Plan

If issues arise:

1. **Revert code changes**: `git revert <commit-hash>`
2. **Redis issues**: Set `REDIS_URL=` to fall back to in-memory
3. **Migration issues**: Restore database from backup
4. **CORS issues**: Temporarily set `ORIGIN_URL=*` (NOT for production long-term)

---

## 📚 Additional Resources

- **SECURITY_AUDIT.md** - Detailed vulnerability analysis
- **SECURITY_REMEDIATION_PLAN.md** - Step-by-step fix guide
- **SECURITY_IMPLEMENTATION_STATUS.md** - Implementation tracking

---

## ❓ FAQ

**Q: Do I need Redis for development?**
A: No, rate limiting will fall back to in-memory. But testing with Redis is recommended.

**Q: What happens to existing API keys?**
A: They need `keyPrefix` added via migration script. Users may need to regenerate.

**Q: Is this backward compatible?**
A: Mostly yes, but API keys require migration and Redis is recommended for production.

**Q: Can I skip some fixes?**
A: Not recommended. Critical fixes (CRIT-01 through CRIT-04) are essential for security.

---

**Last Updated:** 2025-11-13
**Status:** Ready for integration
