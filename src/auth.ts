import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { prisma } from './db.js'
import { logger } from './logger.js'

const SALT_ROUNDS = 10

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Generate a new API key
 * Format: bp_live_xxxxxxxxxxxxxxxxxxxxx (for production)
 *         bp_test_xxxxxxxxxxxxxxxxxxxxx (for development)
 */
export function generateApiKey(): string {
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test'
  const prefix = process.env.API_KEY_PREFIX || 'bp_'
  const randomBytes = crypto.randomBytes(24).toString('hex')
  return `${prefix}${env}_${randomBytes}`
}

/**
 * Hash an API key for storage
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, SALT_ROUNDS)
}

/**
 * Verify an API key against a hash
 */
export async function verifyApiKey(
  apiKey: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(apiKey, hash)
}

/**
 * Validate and authenticate an API key
 * Returns the user and API key data if valid, null otherwise
 */
export async function authenticateApiKey(apiKey: string) {
  try {
    // Find all non-revoked API keys
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        revokedAt: null,
      },
      include: {
        user: true,
      },
    })

    // Check each key (we need to compare hashes)
    for (const key of apiKeys) {
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

        // Update last used timestamp
        await prisma.apiKey.update({
          where: { id: key.id },
          data: { lastUsedAt: new Date() },
        })

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

/**
 * Get rate limit for a user based on their plan
 */
export function getRateLimitForPlan(plan: string): number {
  switch (plan) {
    case 'FREE':
      return parseInt(process.env.RATE_LIMIT_FREE || '5')
    case 'PRO':
      return parseInt(process.env.RATE_LIMIT_PRO || '30')
    case 'ENTERPRISE':
      return parseInt(process.env.RATE_LIMIT_ENTERPRISE || '100')
    default:
      return 5
  }
}

/**
 * Get monthly quota for a user based on their plan
 */
export function getQuotaForPlan(plan: string): number {
  switch (plan) {
    case 'FREE':
      return parseInt(process.env.QUOTA_FREE || '100')
    case 'PRO':
      return parseInt(process.env.QUOTA_PRO || '5000')
    case 'ENTERPRISE':
      return parseInt(process.env.QUOTA_ENTERPRISE || '100000')
    default:
      return 100
  }
}

/**
 * Get or create quota for current month
 */
export async function getCurrentQuota(userId: string) {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  let quota = await prisma.quota.findFirst({
    where: {
      userId,
      periodStart: {
        lte: now,
      },
      periodEnd: {
        gte: now,
      },
    },
  })

  if (!quota) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new Error('User not found')
    }

    quota = await prisma.quota.create({
      data: {
        userId,
        periodStart,
        periodEnd,
        requestsMade: 0,
        requestsLimit: getQuotaForPlan(user.plan),
      },
    })
  }

  return quota
}

/**
 * Check if user has quota remaining
 */
export async function hasQuotaRemaining(userId: string): Promise<boolean> {
  const quota = await getCurrentQuota(userId)
  return quota.requestsMade < quota.requestsLimit
}

/**
 * Increment usage quota
 */
export async function incrementQuota(userId: string): Promise<void> {
  const quota = await getCurrentQuota(userId)
  await prisma.quota.update({
    where: { id: quota.id },
    data: {
      requestsMade: {
        increment: 1,
      },
    },
  })
}
