import Redis from 'ioredis'
import { logger } from './logger.js'

let redis: Redis | null = null

/**
 * Get or create Redis client
 */
export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      reconnectOnError(err) {
        const targetError = 'READONLY'
        if (err.message.includes(targetError)) {
          // Reconnect on READONLY errors
          return true
        }
        logger.error('Redis connection error:', err)
        return false
      },
    })

    redis.on('connect', () => {
      logger.info('Redis connected')
    })

    redis.on('ready', () => {
      logger.info('Redis ready')
    })

    redis.on('error', (err) => {
      logger.error('Redis error:', err)
    })

    redis.on('close', () => {
      logger.warn('Redis connection closed')
    })

    redis.on('reconnecting', () => {
      logger.info('Redis reconnecting...')
    })
  }

  return redis
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return redis !== null && redis.status === 'ready'
}

/**
 * Disconnect Redis client
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    try {
      await redis.quit()
      logger.info('Redis disconnected gracefully')
    } catch (error) {
      logger.error('Error disconnecting Redis:', error)
      // Force disconnect if graceful quit fails
      redis.disconnect()
    }
    redis = null
  }
}

/**
 * Ping Redis to check health
 */
export async function pingRedis(): Promise<boolean> {
  if (!redis) {
    return false
  }

  try {
    const result = await redis.ping()
    return result === 'PONG'
  } catch (error) {
    logger.error('Redis ping failed:', error)
    return false
  }
}
