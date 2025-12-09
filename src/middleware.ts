import type { Context, Next } from 'hono'
import { authenticateApiKey, getRateLimitForPlan, hasQuotaRemaining } from './auth.js'
import { logger } from './logger.js'
import { isRedisAvailable, checkRateLimit as redisCheckRateLimit, getRedis } from './redis.js'
import { sanitizeApiKey } from './utils/sanitize.js'

// Simple in-memory rate limiter (fallback when Redis is not available)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

/**
 * Middleware to authenticate API key
 */
export async function authMiddleware(c: Context, next: Next) {
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '')

  if (!apiKey) {
    return c.json({ error: 'API key is required. Provide it in X-API-Key or Authorization header.' }, 401)
  }

  const auth = await authenticateApiKey(apiKey)

  if (!auth) {
    logger.warn('Invalid API key attempted', { apiKeyPrefix: sanitizeApiKey(apiKey) })
    return c.json({ error: 'Invalid or revoked API key' }, 401)
  }

  // Attach user and apiKey to context
  c.set('user', auth.user)
  c.set('apiKey', auth.apiKey)

  await next()
}

/**
 * Middleware to check rate limits
 * Uses Redis when available, falls back to in-memory
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const rateLimit = getRateLimitForPlan(user.plan)
  const windowMs = 60 * 1000 // 1 minute window

  // Try Redis first
  if (isRedisAvailable()) {
    try {
      const result = await redisCheckRateLimit(user.id, rateLimit, windowMs)

      if (!result.allowed) {
        const resetIn = Math.ceil((result.resetAt - Date.now()) / 1000)
        logger.warn('Rate limit exceeded (Redis)', {
          userId: user.id,
          plan: user.plan,
          limit: rateLimit,
          current: result.current,
        })
        return c.json(
          {
            error: 'Rate limit exceeded',
            limit: rateLimit,
            resetIn,
          },
          429
        )
      }

      // Set rate limit headers
      c.header('X-RateLimit-Limit', rateLimit.toString())
      c.header('X-RateLimit-Remaining', Math.max(0, rateLimit - result.current).toString())
      c.header('X-RateLimit-Reset', new Date(result.resetAt).toISOString())

      await next()
      return
    } catch (error: any) {
      logger.error('Redis rate limiting failed, falling back to in-memory', error)
      // Fall through to in-memory rate limiting
    }
  }

  // Fallback to in-memory rate limiting
  const now = Date.now()
  const key = `rate_limit:${user.id}`
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetAt) {
    // Create new window
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    })
  } else if (record.count >= rateLimit) {
    // Rate limit exceeded
    const resetIn = Math.ceil((record.resetAt - now) / 1000)
    logger.warn('Rate limit exceeded (in-memory)', {
      userId: user.id,
      plan: user.plan,
      limit: rateLimit,
    })
    return c.json(
      {
        error: 'Rate limit exceeded',
        limit: rateLimit,
        resetIn,
      },
      429
    )
  } else {
    // Increment counter
    record.count++
  }

  // Set rate limit headers
  const currentRecord = rateLimitMap.get(key)!
  c.header('X-RateLimit-Limit', rateLimit.toString())
  c.header('X-RateLimit-Remaining', (rateLimit - currentRecord.count).toString())
  c.header('X-RateLimit-Reset', new Date(currentRecord.resetAt).toISOString())

  await next()
}

/**
 * IP-based rate limiting (global protection against DoS)
 */
export async function ipRateLimitMiddleware(c: Context, next: Next) {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('x-real-ip') ||
    'unknown'

  const limit = parseInt(process.env.IP_RATE_LIMIT || '1000') // 1000 requests per minute per IP
  const windowMs = 60 * 1000

  try {
    // Try Redis first
    if (isRedisAvailable()) {
      const redis = getRedis()
      if (redis) {
        const currentWindow = Math.floor(Date.now() / windowMs)
        const key = `ip_rate_limit:${ip}:${currentWindow}`

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
      }
    }

    await next()
  } catch (error) {
    logger.error('IP rate limit check failed:', error)
    await next() // Fail open
  }
}

/**
 * Authentication endpoints rate limiting (IP-based, stricter)
 */
export async function authRateLimitMiddleware(c: Context, next: Next) {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  const endpoint = c.req.path

  const limit = 10 // 10 auth attempts per IP per 15 minutes
  const windowMs = 15 * 60 * 1000

  try {
    if (isRedisAvailable()) {
      const redis = getRedis()
      if (redis) {
        const currentWindow = Math.floor(Date.now() / windowMs)
        const key = `auth_rate_limit:${ip}:${endpoint}:${currentWindow}`

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
      }
    }

    await next()
  } catch (error) {
    logger.error('Auth rate limit check failed:', error)
    await next() // Fail open
  }
}

/**
 * Middleware to check usage quotas
 */
export async function quotaMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const hasQuota = await hasQuotaRemaining(user.id)

  if (!hasQuota) {
    logger.warn('Quota exceeded', {
      userId: user.id,
      plan: user.plan,
    })
    return c.json(
      {
        error: 'Monthly quota exceeded',
        message: 'You have exceeded your monthly screenshot quota. Please upgrade your plan.',
      },
      429
    )
  }

  await next()
}

/**
 * Middleware to check if user is admin
 */
export async function adminMiddleware(c: Context, next: Next) {
  const user = c.get('user')

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  if (!user.isAdmin) {
    logger.warn('Non-admin attempted admin action', { userId: user.id })
    return c.json({ error: 'Admin access required' }, 403)
  }

  await next()
}

/**
 * Security headers middleware
 */
export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next()

  // Skip CSP for binary responses
  const contentType = c.res.headers.get('content-type') || ''
  const isBinary = contentType.includes('image/') ||
    contentType.includes('application/octet-stream')

  // Always set these headers
  c.header('X-Frame-Options', 'DENY')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')

  // Only set CSP for non-binary responses
  if (!isBinary) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')

    c.header('Content-Security-Policy', csp)
  }

  // HSTS only in production
  if (process.env.NODE_ENV === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
}

/**
 * HTTPS enforcement middleware
 */
export async function httpsEnforcementMiddleware(c: Context, next: Next) {
  const proto = c.req.header('x-forwarded-proto') ||
    c.req.header('x-forwarded-protocol') ||
    'http'

  if (process.env.NODE_ENV === 'production' && proto !== 'https') {
    const host = c.req.header('host')
    return c.redirect(`https://${host}${c.req.path}`, 301)
  }

  await next()
}

/**
 * Request timeout middleware
 */
export async function requestTimeoutMiddleware(c: Context, next: Next) {
  const timeout = parseInt(process.env.REQUEST_TIMEOUT || '30000') // 30 seconds

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), timeout)
  )

  try {
    await Promise.race([next(), timeoutPromise])
  } catch (error: any) {
    if (error.message === 'Request timeout') {
      logger.warn('Request timeout', {
        path: c.req.path,
        method: c.req.method,
      })
      return c.json({ error: 'Request timeout' }, 408)
    }
    throw error
  }
}

/**
 * Body size limit middleware
 */
export async function bodySizeLimitMiddleware(c: Context, next: Next) {
  const contentLength = c.req.header('content-length')

  if (contentLength) {
    const maxSize = parseInt(process.env.MAX_BODY_SIZE || '1048576') // 1MB default
    const size = parseInt(contentLength)

    if (size > maxSize) {
      logger.warn('Request body too large', {
        size,
        maxSize,
        path: c.req.path,
      })
      return c.json({ error: 'Request body too large' }, 413)
    }
  }

  await next()
}

/**
 * Clean up expired rate limit records periodically
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}, 60 * 1000) // Clean up every minute
