import type { Redis as RedisType } from 'ioredis'
import { Redis } from 'ioredis'
import { logger } from './logger.js'

/**
 * Redis client for distributed rate limiting and caching
 */

let redisClient: RedisType | null = null

/**
 * Initialize Redis client
 */
export function initRedis(): RedisType | null {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    logger.warn('REDIS_URL not configured, falling back to in-memory rate limiting')
    return null
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      reconnectOnError(err: Error) {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT']
        return targetErrors.some(targetError => err.message.includes(targetError))
      },
    })

    redisClient!.on('connect', () => {
      logger.info('Redis connected successfully')
    })

    redisClient!.on('error', (error) => {
      logger.error('Redis connection error:', error)
    })

    redisClient!.on('close', () => {
      logger.warn('Redis connection closed')
    })

    redisClient!.on('reconnecting', () => {
      logger.info('Redis reconnecting...')
    })

    return redisClient
  } catch (error: any) {
    logger.error('Failed to initialize Redis:', error)
    return null
  }
}

/**
 * Get Redis client instance
 */
export function getRedis(): RedisType | null {
  return redisClient
}

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redisClient !== null && redisClient.status === 'ready'
}

/**
 * Rate limiting with Redis using sliding window counter
 */
export async function checkRateLimit(
  userId: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; current: number; resetAt: number }> {
  if (!isRedisAvailable()) {
    throw new Error('Redis not available')
  }

  const key = `rate_limit:${userId}`
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    // Use Redis sorted set for sliding window
    const pipeline = redisClient!.pipeline()

    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart)

    // Count requests in current window
    pipeline.zcard(key)

    // Add current request
    pipeline.zadd(key, now, `${now}:${Math.random()}`)

    // Set expiry on the key
    pipeline.expire(key, Math.ceil(windowMs / 1000))

    const results = await pipeline.exec()

    if (!results) {
      throw new Error('Redis pipeline failed')
    }

    // Get count after removing old entries
    const count = results[1][1] as number
    const allowed = count < limit
    const resetAt = now + windowMs

    return {
      allowed,
      current: count + 1, // Include current request
      resetAt,
    }
  } catch (error: any) {
    logger.error('Error checking rate limit with Redis:', error)
    throw error
  }
}

/**
 * Get current rate limit status
 */
export async function getRateLimitStatus(
  userId: string,
  windowMs: number
): Promise<{ current: number; resetAt: number } | null> {
  if (!isRedisAvailable()) {
    return null
  }

  const key = `rate_limit:${userId}`
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    // Remove old entries and get count
    await redisClient!.zremrangebyscore(key, 0, windowStart)
    const count = await redisClient!.zcard(key)

    return {
      current: count,
      resetAt: now + windowMs,
    }
  } catch (error: any) {
    logger.error('Error getting rate limit status:', error)
    return null
  }
}

/**
 * Clear rate limit for a user (useful for testing or admin overrides)
 */
export async function clearRateLimit(userId: string): Promise<void> {
  if (!isRedisAvailable()) {
    return
  }

  const key = `rate_limit:${userId}`

  try {
    await redisClient!.del(key)
    logger.info('Rate limit cleared', { userId })
  } catch (error: any) {
    logger.error('Error clearing rate limit:', error)
    throw error
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit()
      logger.info('Redis connection closed gracefully')
    } catch (error: any) {
      logger.error('Error closing Redis connection:', error)
    }
  }
}
