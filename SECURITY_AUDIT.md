# Security Audit Report - Browser Pool SaaS

**Date:** 2025-11-05
**Auditor:** Claude (Automated Security Analysis)
**Scope:** Complete codebase security review
**Status:** 30 Issues Identified (4 Critical, 7 High, 11 Medium, 8 Low)

---

## Executive Summary

This security audit identified **30 security issues** across the Browser Pool SaaS application. While the application demonstrates good security practices in many areas (bcrypt password hashing, HMAC webhook signatures, comprehensive audit logging, Prisma ORM for SQL injection protection), several critical issues require immediate attention.

**Key Strengths:**
- ✅ Bcrypt password hashing (10 rounds)
- ✅ HMAC-SHA256 webhook signatures with timing-safe comparison
- ✅ Comprehensive audit logging
- ✅ Prisma ORM prevents SQL injection
- ✅ API key hashing and secure generation
- ✅ Input validation with Zod schemas
- ✅ No known dependency vulnerabilities

**Critical Areas Requiring Immediate Action:**
- 🔴 API Key authentication timing vulnerability
- 🔴 Rate limiting not production-ready (in-memory only)
- 🔴 CORS allows all origins by default
- 🔴 Missing security headers
- 🔴 SSRF vulnerability in screenshot endpoint

---

## Critical Issues (Priority 1 - Fix Immediately)

### 🔴 CRIT-01: API Key Authentication Timing Attack

**Location:** `src/auth.ts:58-101`

**Issue:**
The `authenticateApiKey()` function loads ALL non-revoked API keys from the database and compares them sequentially. This creates a timing side-channel that could leak:
- Number of API keys in the system
- Position of matching key in the list
- Database query time variations

```typescript
// VULNERABLE CODE
const apiKeys = await prisma.apiKey.findMany({
  where: { revokedAt: null },
  include: { user: true },
})

for (const key of apiKeys) {
  const isValid = await verifyApiKey(apiKey, key.key)
  if (isValid) {
    // ... authenticate user
  }
}
```

**Attack Scenario:**
1. Attacker measures response time for authentication
2. Longer times indicate more API keys in system
3. Timing differences help brute-force API keys
4. At scale, can leak business information (number of customers)

**Impact:** High - Information leakage, potential for enhanced brute-force attacks

**Recommendation:**
- Add an API key index column (first 8 chars of hash) to enable direct lookup
- OR: Use constant-time comparison by checking ALL keys regardless of match
- OR: Extract prefix from API key (e.g., key ID) and do direct lookup

**Fixed Code Pattern:**
```typescript
// Option 1: Add key prefix/ID for direct lookup
const keyPrefix = extractKeyPrefix(apiKey) // e.g., "bp_live_12345678"
const apiKeyRecord = await prisma.apiKey.findFirst({
  where: { keyPrefix, revokedAt: null },
  include: { user: true }
})

if (!apiKeyRecord) return null

const isValid = await verifyApiKey(apiKey, apiKeyRecord.key)
if (!isValid) return null

// Continue authentication...
```

---

### 🔴 CRIT-02: In-Memory Rate Limiting (Not Production-Ready)

**Location:** `src/middleware.ts:5-143`

**Issue:**
Rate limiting uses an in-memory `Map` that is:
- Not shared across multiple server instances
- Lost on server restart
- Vulnerable to memory exhaustion
- Not persistent

```typescript
// VULNERABLE CODE
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
```

**Attack Scenario:**
1. Attacker sends 30 requests to Server A (hits limit)
2. Sends 30 requests to Server B (different instance - no limit)
3. Repeats across all servers, bypassing rate limiting entirely

**Impact:** Critical in production - DDoS protection ineffective, quota bypass possible

**Recommendation:**
Implement distributed rate limiting with Redis:

```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

export async function rateLimitMiddleware(c: Context, next: Next) {
  const user = c.get('user')
  const rateLimit = getRateLimitForPlan(user.plan)
  const key = `rate_limit:${user.id}:${Math.floor(Date.now() / 60000)}`

  const current = await redis.incr(key)

  if (current === 1) {
    await redis.expire(key, 60) // 1 minute TTL
  }

  if (current > rateLimit) {
    return c.json({ error: 'Rate limit exceeded' }, 429)
  }

  c.header('X-RateLimit-Limit', rateLimit.toString())
  c.header('X-RateLimit-Remaining', (rateLimit - current).toString())

  await next()
}
```

---

### 🔴 CRIT-03: CORS Allows All Origins by Default

**Location:** `src/index.ts:39-46`

**Issue:**
CORS configuration defaults to `*` (all origins) if `ORIGIN_URL` is not set:

```typescript
cors({
  origin: String(process.env.ORIGIN_URL || '*'),  // ⚠️ Defaults to '*'
  maxAge: 600,
  credentials: true,  // ⚠️ credentials:true with origin:'*' is dangerous
})
```

**Impact:**
- Any website can make authenticated requests to your API
- Credential theft via malicious sites
- CSRF attacks possible

**Security Issue:**
The combination of `credentials: true` and `origin: '*'` is explicitly forbidden by CORS spec and creates security vulnerabilities.

**Recommendation:**

```typescript
// Option 1: Strict validation
const allowedOrigins = (process.env.ORIGIN_URL || '').split(',').filter(Boolean)

if (allowedOrigins.length === 0) {
  throw new Error('ORIGIN_URL must be configured for security')
}

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return true // Same-origin requests
    return allowedOrigins.includes(origin)
  },
  maxAge: 600,
  credentials: true,
}))

// Option 2: Disable credentials if no origin set
app.use('*', cors({
  origin: process.env.ORIGIN_URL || false,
  credentials: !!process.env.ORIGIN_URL,
  maxAge: 600,
}))
```

---

### 🔴 CRIT-04: Missing Security Headers

**Location:** `src/index.ts` (missing middleware)

**Issue:**
Application doesn't set critical security headers, exposing users to:
- Clickjacking attacks (missing X-Frame-Options)
- MIME sniffing attacks (missing X-Content-Type-Options)
- XSS attacks (missing Content-Security-Policy)
- Mixed content (missing Strict-Transport-Security)

**Current State:**
No security headers are set at all.

**Impact:**
- Application can be embedded in malicious iframes
- Browser vulnerabilities more exploitable
- Fails security scanners and compliance checks

**Recommendation:**

```typescript
import { secureHeaders } from 'hono/secure-headers'

// Add after other middleware
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    camera: [],
    microphone: [],
    geolocation: [],
  },
}))
```

---

## High-Severity Issues (Priority 2 - Fix Soon)

### 🟠 HIGH-01: No Rate Limiting on Authentication Endpoints

**Location:** `src/routes/auth.ts:27, :122`

**Issue:**
Login and registration endpoints have no rate limiting, enabling:
- Credential stuffing attacks
- Password brute-force attacks
- User enumeration via timing
- Email spam via registration

**Attack Scenario:**
```bash
# Brute force login
for password in $(cat passwords.txt); do
  curl -X POST /auth/login \
    -d "{\"email\":\"admin@company.com\",\"password\":\"$password\"}"
done
```

**Recommendation:**

```typescript
// Add IP-based rate limiting for auth endpoints
import { RateLimiter } from 'limiter'

const authLimiter = new Map<string, RateLimiter>()

function getIPRateLimiter(ip: string): RateLimiter {
  if (!authLimiter.has(ip)) {
    authLimiter.set(ip, new RateLimiter({
      tokensPerInterval: 5,
      interval: 'minute'
    }))
  }
  return authLimiter.get(ip)!
}

authRouter.post('/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
  const limiter = getIPRateLimiter(ip)

  if (!await limiter.tryRemoveTokens(1)) {
    return c.json({ error: 'Too many login attempts. Try again later.' }, 429)
  }

  // ... rest of login logic
})
```

---

### 🟠 HIGH-02: SSRF Vulnerability in Screenshot Endpoint

**Location:** `src/index.ts:81-195`

**Issue:**
The `/screenshot` endpoint accepts any URL without validation:

```typescript
const { url, cookieConsent = true } = await c.req.json()

if (!url) {
  return c.json({error: 'URL is required'}, 400)
}

await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 60000})
```

**Attack Scenarios:**

1. **Internal Network Scanning:**
```bash
curl -X POST /screenshot \
  -H "X-API-Key: $KEY" \
  -d '{"url": "http://192.168.1.1/admin"}'
# Returns screenshot of internal router admin page
```

2. **Cloud Metadata Theft:**
```bash
curl -X POST /screenshot \
  -H "X-API-Key: $KEY" \
  -d '{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"}'
# Steals AWS credentials
```

3. **File System Access:**
```bash
curl -X POST /screenshot \
  -H "X-API-Key: $KEY" \
  -d '{"url": "file:///etc/passwd"}'
```

**Impact:** Critical - Can access internal services, steal cloud credentials, scan networks

**Recommendation:**

```typescript
import { URL } from 'url'

function isAllowedURL(urlString: string): { allowed: boolean; reason?: string } {
  try {
    const url = new URL(urlString)

    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { allowed: false, reason: 'Only HTTP/HTTPS protocols allowed' }
    }

    // Block private IP ranges
    const hostname = url.hostname
    const privateRanges = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^192\.168\./,
      /^169\.254\./, // AWS metadata
      /^::1$/, // IPv6 localhost
      /^fc00:/, // IPv6 private
    ]

    if (privateRanges.some(range => range.test(hostname))) {
      return { allowed: false, reason: 'Private IP addresses not allowed' }
    }

    // Block cloud metadata endpoints
    const blockedHosts = [
      'metadata.google.internal',
      '169.254.169.254',
    ]

    if (blockedHosts.includes(hostname)) {
      return { allowed: false, reason: 'Blocked hostname' }
    }

    return { allowed: true }
  } catch (error) {
    return { allowed: false, reason: 'Invalid URL format' }
  }
}

// In screenshot endpoint:
app.post('/screenshot', authMiddleware, rateLimitMiddleware, quotaMiddleware, async (c) => {
  const { url, cookieConsent = true } = await c.req.json()

  if (!url) {
    return c.json({ error: 'URL is required' }, 400)
  }

  const validation = isAllowedURL(url)
  if (!validation.allowed) {
    return c.json({ error: `Invalid URL: ${validation.reason}` }, 400)
  }

  // ... rest of code
})
```

---

### 🟠 HIGH-03: No Account Lockout on Failed Login Attempts

**Location:** `src/routes/auth.ts:122-216`

**Issue:**
No account lockout mechanism after repeated failed login attempts. Attacker can attempt unlimited password guesses.

**Recommendation:**

```typescript
// Add to User model in schema.prisma:
// failedLoginAttempts Int @default(0)
// lockedUntil DateTime?

async function checkAccountLock(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true }
  })

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return true // Account is locked
  }

  return false
}

async function handleFailedLogin(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true }
  })

  const attempts = (user?.failedLoginAttempts || 0) + 1

  if (attempts >= 5) {
    // Lock account for 15 minutes
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000)
      }
    })
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: attempts }
    })
  }
}

async function handleSuccessfulLogin(userId: string): Promise<void> {
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

---

### 🟠 HIGH-04: Weak Request ID Generation

**Location:** `src/errorHandler.ts:77-79`

**Issue:**
Request IDs use `Math.random()` which is not cryptographically secure:

```typescript
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}
```

**Problems:**
- Predictable sequence
- Could be guessed/enumerated
- Not suitable for security-sensitive tracking

**Recommendation:**

```typescript
import crypto from 'crypto'

function generateRequestId(): string {
  const timestamp = Date.now()
  const randomBytes = crypto.randomBytes(12).toString('base64url')
  return `req_${timestamp}_${randomBytes}`
}
```

---

### 🟠 HIGH-05: No Rate Limiting on Password Reset

**Location:** `src/routes/account.ts:36-99`

**Issue:**
Password reset endpoint has no rate limiting, enabling:
- Email spam attacks
- User harassment
- Resource exhaustion
- Email service quota consumption

**Recommendation:**

```typescript
// Add IP-based rate limiting (similar to HIGH-01)
const passwordResetLimiter = new Map<string, number>()

accountRouter.post('/request-password-reset', async (c) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown'
  const key = `pwd_reset:${ip}`

  const count = passwordResetLimiter.get(key) || 0
  if (count >= 3) {
    return c.json({
      error: 'Too many password reset requests. Try again later.'
    }, 429)
  }

  passwordResetLimiter.set(key, count + 1)
  setTimeout(() => passwordResetLimiter.delete(key), 60 * 60 * 1000) // 1 hour

  // ... rest of code
})
```

---

### 🟠 HIGH-06: Email Enumeration via Login Timing

**Location:** `src/routes/auth.ts:140-175`

**Issue:**
Login endpoint reveals whether email exists via timing differences:

```typescript
const user = await prisma.user.findUnique({ where: { email } })

if (!user) {
  return c.json({ error: 'Invalid email or password' }, 401)
}

const isValid = await verifyPassword(password, user.passwordHash) // bcrypt takes ~100ms

if (!isValid) {
  return c.json({ error: 'Invalid email or password' }, 401)
}
```

**Attack:**
1. Non-existent email → Fast response (~10ms)
2. Valid email + wrong password → Slow response (~110ms, includes bcrypt)
3. Attacker can enumerate all registered emails

**Recommendation:**

```typescript
authRouter.post('/login', async (c) => {
  const { email, password } = validation.data

  const user = await prisma.user.findUnique({ where: { email } })

  // ALWAYS perform bcrypt comparison, even if user doesn't exist
  const dummyHash = '$2b$10$dummyhashtopreventtimingleaksxxxxxxxxxxxxxxxxxxx'
  const passwordHash = user?.passwordHash || dummyHash

  const isValid = await verifyPassword(password, passwordHash)

  if (!user || !isValid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // ... rest of code
})
```

---

### 🟠 HIGH-07: No HTTPS Enforcement

**Location:** Missing from `src/index.ts`

**Issue:**
Application doesn't enforce HTTPS, allowing:
- Man-in-the-middle attacks
- API key theft
- Password interception

**Recommendation:**

```typescript
// Add HTTPS redirect middleware
app.use('*', async (c, next) => {
  const proto = c.req.header('x-forwarded-proto') ||
                c.req.header('x-forwarded-protocol') ||
                'http'

  if (process.env.NODE_ENV === 'production' && proto !== 'https') {
    const host = c.req.header('host')
    return c.redirect(`https://${host}${c.req.path}`, 301)
  }

  await next()
})
```

---

## Medium-Severity Issues (Priority 3 - Fix in Next Release)

### 🟡 MED-01: Sensitive Data Logging

**Location:** Multiple files - `src/dodo.ts:95-126`, `src/middleware.ts:22`

**Issue:**
Logs contain potentially sensitive information:
- API key prefixes (could help brute-force)
- Email addresses
- Request payloads (may contain PII)
- Dodo API request/response data

**Examples:**
```typescript
// src/middleware.ts:22
logger.warn('Invalid API key attempted', {
  apiKey: apiKey.substring(0, 10) + '...'  // ⚠️ Leaks 10 chars
})

// src/dodo.ts:100
logger.debug('Dodo API Request:', {
  method: config.method,
  url: config.url,
  data: config.data,  // ⚠️ Could contain PII
})
```

**Recommendation:**

```typescript
// Create sanitized logging utility
function sanitizeForLogging(data: any): any {
  const sensitive = ['password', 'apiKey', 'token', 'secret', 'authorization']

  if (typeof data === 'string') {
    return data.length > 4 ? `${data.substring(0, 4)}***` : '***'
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '***REDACTED***'
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeForLogging(value)
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  return data
}

// Usage:
logger.warn('Invalid API key attempted', {
  apiKeyPrefix: 'bp_***'  // Only log known prefix
})
```

---

### 🟡 MED-02: API Keys Never Expire

**Location:** `src/auth.ts`, `prisma/schema.prisma`

**Issue:**
API keys have no expiration date. Once compromised, they remain valid indefinitely until manually revoked.

**Recommendation:**

```typescript
// Add to schema.prisma ApiKey model:
// expiresAt DateTime?

// Modify authenticateApiKey:
export async function authenticateApiKey(apiKey: string) {
  // ... existing code ...

  // Check expiration
  if (key.expiresAt && key.expiresAt < new Date()) {
    logger.warn('Expired API key used', { userId: key.userId })
    return null
  }

  // ... rest of code
}

// Add rotation reminder endpoint:
app.get('/users/api-keys/expiring', authMiddleware, async (c) => {
  const user = c.get('user')
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const expiringKeys = await prisma.apiKey.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
      expiresAt: { lte: thirtyDaysFromNow }
    }
  })

  return c.json({ expiringKeys })
})
```

---

### 🟡 MED-03: No Webhook Retry Logic

**Location:** `src/webhooks.ts:30-72`

**Issue:**
Failed webhooks are lost forever. No retry mechanism for transient failures.

**Recommendation:**

```typescript
// Add webhook queue with retry logic
interface WebhookJob {
  id: string
  webhookId: string
  url: string
  payload: WebhookPayload
  secret: string
  attempts: number
  maxAttempts: number
  nextRetry: Date
}

const webhookQueue: WebhookJob[] = []

async function enqueueWebhook(webhook: any, payload: WebhookPayload) {
  webhookQueue.push({
    id: crypto.randomBytes(16).toString('hex'),
    webhookId: webhook.id,
    url: webhook.url,
    payload,
    secret: webhook.secret,
    attempts: 0,
    maxAttempts: 3,
    nextRetry: new Date()
  })
}

// Background processor
setInterval(async () => {
  const now = new Date()
  const ready = webhookQueue.filter(job => job.nextRetry <= now)

  for (const job of ready) {
    const success = await sendWebhook(job.url, job.payload, job.secret)

    if (success) {
      // Remove from queue
      webhookQueue.splice(webhookQueue.indexOf(job), 1)
    } else {
      job.attempts++
      if (job.attempts >= job.maxAttempts) {
        // Max retries reached, remove from queue
        logger.error('Webhook max retries exceeded', { job })
        webhookQueue.splice(webhookQueue.indexOf(job), 1)
      } else {
        // Exponential backoff: 1min, 5min, 15min
        const backoff = Math.pow(5, job.attempts) * 60 * 1000
        job.nextRetry = new Date(Date.now() + backoff)
      }
    }
  }
}, 30000) // Check every 30 seconds
```

---

### 🟡 MED-04: Webhook Timeout Too Long

**Location:** `src/webhooks.ts:46`

**Issue:**
10-second timeout can block request processing:

```typescript
const response = await axios.post(url, payload, {
  timeout: 10000, // 10 seconds - too long!
})
```

**Recommendation:**

```typescript
// Reduce timeout and make webhooks truly async
const response = await axios.post(url, payload, {
  headers: { /* ... */ },
  timeout: 3000, // 3 seconds max
  validateStatus: (status) => status >= 200 && status < 300
})
```

---

### 🟡 MED-05: No Maximum Request Body Size

**Location:** Missing from `src/index.ts`

**Issue:**
No limit on request body size, enabling DoS attacks via large payloads.

**Recommendation:**

```typescript
import { bodyLimit } from 'hono/body-limit'

// Add body size limit
app.use('*', bodyLimit({
  maxSize: 1024 * 1024, // 1MB max
  onError: (c) => {
    return c.json({ error: 'Request body too large' }, 413)
  }
}))
```

---

### 🟡 MED-06: No Maximum Password Length

**Location:** `src/routes/auth.ts:14`

**Issue:**
Only minimum password length is enforced:

```typescript
password: z.string().min(8, 'Password must be at least 8 characters')
```

Extremely long passwords can cause bcrypt DoS (bcrypt is intentionally slow).

**Recommendation:**

```typescript
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'), // Add max
  name: z.string().min(1, 'Name is required'),
})
```

---

### 🟡 MED-07: Password Reset Token Reuse Window

**Location:** `src/routes/account.ts:105-172`

**Issue:**
Password reset tokens are only deleted AFTER successful use. Within the 1-hour window, a token could theoretically be reused if the attacker captures it.

**Recommendation:**

```typescript
// Add used timestamp to detect reuse
accountRouter.post('/reset-password', async (c) => {
  // ... validation ...

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

  const passwordHash = await hashPassword(newPassword)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
      passwordResetUsedAt: new Date(),  // NEW: Mark as used
    },
  })

  // ... rest of code
})
```

---

### 🟡 MED-08: Missing Monitoring and Alerting

**Location:** N/A - Missing feature

**Issue:**
No alerting for suspicious activities:
- Multiple failed login attempts from single IP
- Unusual API usage patterns
- Admin actions
- Quota abuse
- Webhook failures

**Recommendation:**

```typescript
// Add security monitoring service
class SecurityMonitor {
  async checkSuspiciousActivity(event: SecurityEvent): Promise<void> {
    // Check various patterns
    if (await this.isRateLimitAbuse(event)) {
      await this.sendAlert('Rate limit abuse detected', event)
    }

    if (await this.isCredentialStuffing(event)) {
      await this.sendAlert('Potential credential stuffing', event)
    }
  }

  private async isRateLimitAbuse(event: SecurityEvent): Promise<boolean> {
    // Multiple 429 responses from same IP
    const recentRateLimits = await prisma.auditLog.count({
      where: {
        ipAddress: event.ipAddress,
        action: 'rate_limit.exceeded',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }
      }
    })

    return recentRateLimits > 10
  }
}
```

---

### 🟡 MED-09: No IP-Based Rate Limiting

**Location:** `src/middleware.ts:36-84`

**Issue:**
Rate limiting is only per-user. Attacker can create multiple free accounts to bypass limits.

**Recommendation:**

```typescript
// Add IP-based rate limiting in addition to user-based
export async function ipRateLimitMiddleware(c: Context, next: Next) {
  const ip = c.req.header('x-forwarded-for') || 'unknown'
  const key = `ip_rate_limit:${ip}`

  // Use Redis or in-memory map
  const record = rateLimitMap.get(key)
  const limit = 100 // 100 requests per minute per IP

  if (record && record.count >= limit) {
    return c.json({ error: 'IP rate limit exceeded' }, 429)
  }

  await next()
}

// Apply to all routes
app.use('*', ipRateLimitMiddleware)
```

---

### 🟡 MED-10: Incomplete GDPR Account Deletion

**Location:** `src/routes/account.ts:496-549`

**Issue:**
Account deletion doesn't cancel active subscriptions in Dodo:

```typescript
// TODO: Cancel subscriptions in Dodo Payments
// for (const sub of activeSubscriptions) {
//   await dodoPayments.cancelSubscription(sub.dodoSubscriptionId, false)
// }
```

This could lead to:
- Continued billing after account deletion
- GDPR compliance issues
- Customer disputes

**Recommendation:**

```typescript
// Implement subscription cancellation
accountRouter.delete('/', authMiddleware, async (c) => {
  // ... existing code ...

  // Cancel active subscriptions
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
      // Still proceed with deletion, but alert admin
    }
  }

  // ... rest of deletion code
})
```

---

### 🟡 MED-11: Browser Pool URL Validation

**Location:** `src/index.ts:106` (related to HIGH-02)

**Issue:**
No validation on URLs before passing to Playwright. While covered in HIGH-02 for SSRF, also need additional browser-specific protections.

**Recommendation:**

```typescript
// Additional browser-specific URL validation
function isSafeForBrowser(url: string): boolean {
  try {
    const parsed = new URL(url)

    // Block dangerous protocols
    const blockedProtocols = ['file:', 'ftp:', 'data:', 'javascript:']
    if (blockedProtocols.includes(parsed.protocol)) {
      return false
    }

    // Ensure URL doesn't contain dangerous patterns
    const dangerous = ['<script', 'javascript:', 'data:text/html']
    if (dangerous.some(pattern => url.toLowerCase().includes(pattern))) {
      return false
    }

    return true
  } catch {
    return false
  }
}
```

---

## Low-Severity Issues (Priority 4 - Nice to Have)

### 🟢 LOW-01: Stack Traces Exposed in Development Mode

**Location:** `src/errorHandler.ts:19-27`

**Issue:**
Stack traces are exposed when `NODE_ENV !== 'production'`. If accidentally deployed with wrong env var, leaks internal code structure.

**Recommendation:**

```typescript
// Always sanitize, add explicit dev flag
const isDevelopment = process.env.NODE_ENV === 'development' &&
                     process.env.EXPOSE_ERRORS === 'true'

return c.json({
  error: 'Internal server error',
  message: isDevelopment ? err.message : 'An unexpected error occurred',
  requestId,
  ...(isDevelopment ? { stack: err.stack } : {})
}, 500)
```

---

### 🟢 LOW-02: Verbose Database Logging in Production

**Location:** `src/db.ts:4-11`

**Issue:**
Prisma logs all queries in production, potentially logging sensitive data.

**Recommendation:**

```typescript
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production'
    ? ['error', 'warn']
    : ['query', 'error', 'warn', 'info']
})
```

---

### 🟢 LOW-03: Weak JWT Secret Default

**Location:** `.env.example:10`

**Issue:**
Example JWT secret is weak and might be used in production:

```
JWT_SECRET=change-this-to-a-random-secret-key-in-production
```

**Recommendation:**

```typescript
// Validate JWT_SECRET on startup
if (process.env.NODE_ENV === 'production') {
  const jwtSecret = process.env.JWT_SECRET || ''

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production')
  }

  if (jwtSecret.includes('change-this')) {
    throw new Error('Please change the default JWT_SECRET')
  }
}
```

---

### 🟢 LOW-04: No Database Connection Pooling Limits

**Location:** `src/db.ts`

**Issue:**
No explicit connection pool limits. Under heavy load, could exhaust database connections.

**Recommendation:**

```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Add connection pool settings
  __internal: {
    engine: {
      connection_limit: parseInt(process.env.DB_CONNECTION_LIMIT || '10')
    }
  }
})
```

---

### 🟢 LOW-05: No Request Timeout

**Location:** `src/index.ts`

**Issue:**
No global request timeout. Slow clients can hold connections indefinitely.

**Recommendation:**

```typescript
app.use('*', async (c, next) => {
  const timeout = 30000 // 30 seconds
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeout)
  )

  try {
    await Promise.race([next(), timeoutPromise])
  } catch (error: any) {
    if (error.message === 'Request timeout') {
      return c.json({ error: 'Request timeout' }, 408)
    }
    throw error
  }
})
```

---

### 🟢 LOW-06: Missing Audit Log Retention Policy

**Location:** `prisma/schema.prisma` - AuditLog model

**Issue:**
Audit logs grow indefinitely. No cleanup or archival strategy.

**Recommendation:**

```typescript
// Add cleanup job
async function cleanupOldAuditLogs() {
  const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90')
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const deleted = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate }
    }
  })

  logger.info('Cleaned up old audit logs', { deleted: deleted.count })
}

// Run daily
setInterval(cleanupOldAuditLogs, 24 * 60 * 60 * 1000)
```

---

### 🟢 LOW-07: No Health Check for Dependencies

**Location:** `src/index.ts:58-63`

**Issue:**
Health check only returns static response. Doesn't verify database, Redis, or browser pool health.

**Recommendation:**

```typescript
app.get('/health', async (c) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'ok',
      browserPool: 'ok',
      redis: 'ok'
    }
  }

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (error) {
    health.status = 'degraded'
    health.checks.database = 'error'
  }

  // Check browser pool
  try {
    const stats = browserPool.getStats()
    if (stats.available === 0) {
      health.checks.browserPool = 'degraded'
    }
  } catch (error) {
    health.status = 'degraded'
    health.checks.browserPool = 'error'
  }

  return c.json(health, health.status === 'ok' ? 200 : 503)
})
```

---

### 🟢 LOW-08: Browser Pool Resource Limits

**Location:** `src/BrowserPool.ts`

**Issue:**
No explicit memory or CPU limits for browser processes. Could cause system resource exhaustion.

**Recommendation:**

```typescript
// Add resource limits when launching browser
const browser = await chromium.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--max-old-space-size=512', // Limit memory to 512MB per browser
    '--disable-gpu',
  ],
  // Add timeout for browser operations
  timeout: 30000
})
```

---

## Summary of Findings

### By Severity

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 Critical | 4 | CRIT-01 to CRIT-04 |
| 🟠 High | 7 | HIGH-01 to HIGH-07 |
| 🟡 Medium | 11 | MED-01 to MED-11 |
| 🟢 Low | 8 | LOW-01 to LOW-08 |
| **Total** | **30** | |

### By Category

| Category | Issues |
|----------|--------|
| Authentication & Authorization | 8 issues |
| Rate Limiting & DoS Protection | 6 issues |
| Input Validation | 4 issues |
| Data Protection | 4 issues |
| Network Security | 3 issues |
| Logging & Monitoring | 3 issues |
| Configuration | 2 issues |

---

## Remediation Roadmap

### Phase 1: Critical Fixes (Week 1-2)
- [ ] **CRIT-01:** Implement indexed API key lookup
- [ ] **CRIT-02:** Deploy Redis-based rate limiting
- [ ] **CRIT-03:** Fix CORS configuration
- [ ] **CRIT-04:** Add security headers middleware
- [ ] **HIGH-02:** Implement SSRF protection

**Estimated Effort:** 40-60 hours

### Phase 2: High-Priority Fixes (Week 3-4)
- [ ] **HIGH-01:** Add authentication rate limiting
- [ ] **HIGH-03:** Implement account lockout
- [ ] **HIGH-04:** Fix request ID generation
- [ ] **HIGH-05:** Add password reset rate limiting
- [ ] **HIGH-06:** Fix email enumeration timing
- [ ] **HIGH-07:** Enforce HTTPS

**Estimated Effort:** 30-40 hours

### Phase 3: Medium-Priority Fixes (Week 5-6)
- [ ] **MED-01 to MED-11:** Address all medium issues
- [ ] Add comprehensive security testing
- [ ] Update documentation

**Estimated Effort:** 40-50 hours

### Phase 4: Low-Priority & Hardening (Week 7-8)
- [ ] **LOW-01 to LOW-08:** Address all low issues
- [ ] Implement monitoring and alerting
- [ ] Security audit of dependencies
- [ ] Penetration testing

**Estimated Effort:** 20-30 hours

---

## Testing Recommendations

### Security Testing Checklist

1. **Authentication Testing**
   - [ ] Test API key brute-force protection
   - [ ] Verify rate limiting on login
   - [ ] Test account lockout mechanism
   - [ ] Verify password reset flow security

2. **Authorization Testing**
   - [ ] Test user isolation (can't access other users' data)
   - [ ] Test admin-only endpoints
   - [ ] Verify API key revocation works

3. **Input Validation Testing**
   - [ ] Test SSRF protection with internal IPs
   - [ ] Test XSS in all input fields
   - [ ] Test SQL injection (should be blocked by Prisma)
   - [ ] Test file upload vulnerabilities

4. **Rate Limiting Testing**
   - [ ] Verify per-user rate limits
   - [ ] Verify per-IP rate limits
   - [ ] Test distributed rate limiting (multi-server)

5. **Network Security Testing**
   - [ ] Verify CORS configuration
   - [ ] Test security headers
   - [ ] Verify HTTPS enforcement
   - [ ] Test webhook signature verification

---

## Compliance Considerations

### GDPR
- ✅ Data export functionality exists
- ✅ Account deletion functionality exists
- ⚠️ Need to implement subscription cancellation in deletion flow
- ⚠️ Need audit log retention policy

### OWASP Top 10 (2021)
- ✅ A01: Broken Access Control - Good (role-based auth, user isolation)
- ⚠️ A02: Cryptographic Failures - Good (bcrypt, HMAC) but improve key rotation
- ⚠️ A03: Injection - Good (Prisma ORM) but add SSRF protection
- ⚠️ A04: Insecure Design - Fix rate limiting, add monitoring
- ⚠️ A05: Security Misconfiguration - Fix CORS, add security headers
- ✅ A06: Vulnerable Components - No known vulnerabilities
- ⚠️ A07: Authentication Failures - Add account lockout, fix timing attacks
- ✅ A08: Software and Data Integrity - Good (webhook signatures, audit logs)
- ⚠️ A09: Security Logging Failures - Good logging but sanitize sensitive data
- ⚠️ A10: SSRF - Add URL validation for screenshot endpoint

---

## Monitoring and Detection

### Security Metrics to Track

1. **Authentication Metrics**
   - Failed login attempts per IP
   - Account lockouts per day
   - Invalid API key attempts

2. **Rate Limiting Metrics**
   - 429 responses per endpoint
   - Rate limit abuse patterns
   - Quota exhaustion events

3. **Application Metrics**
   - Error rates by endpoint
   - Response time percentiles
   - Database connection pool usage

4. **Security Events**
   - Admin actions
   - Password resets
   - Account deletions
   - Subscription changes

---

## Contact

For questions about this security audit, please contact the development team.

**Last Updated:** 2025-11-05
