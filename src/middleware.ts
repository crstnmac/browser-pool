import { Context, Next } from 'hono'
import { authenticateApiKey, getRateLimitForPlan, hasQuotaRemaining } from './auth.js'
import { logger } from './logger.js'
import { isRedisAvailable, checkRateLimit as redisCheckRateLimit } from './redis.js'

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
    logger.warn('Invalid API key attempted', { apiKey: apiKey.substring(0, 10) + '...' })
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
