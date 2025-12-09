import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoBindings } from '../types.js'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { generateApiKey, hashApiKey, getCurrentQuota } from '../auth.js'
import { logger } from '../logger.js'

const usersRouter = new Hono<HonoBindings>()

// Apply auth middleware to all routes
usersRouter.use('*', authMiddleware)

const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required'),
})

/**
 * GET /users/me
 * Get current user profile
 */
usersRouter.get('/me', async (c) => {
  try {
    const user = c.get('user')

    const userWithDetails = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        status: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return c.json({ user: userWithDetails })
  } catch (error: any) {
    logger.error('Error fetching user profile:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /users/usage
 * Get current usage statistics
 */
usersRouter.get('/usage', async (c) => {
  try {
    const user = c.get('user')
    const quota = await getCurrentQuota(user.id)

    // Get total usage statistics
    const [totalScreenshots, totalApiCalls] = await Promise.all([
      prisma.usageLog.count({
        where: {
          userId: user.id,
          endpoint: {
            in: ['/screenshot', '/screenshot/bulk'],
          },
        },
      }),
      prisma.usageLog.count({
        where: {
          userId: user.id,
        },
      }),
    ])

    // Get usage logs for current month
    const usageLogs = await prisma.usageLog.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: quota.periodStart,
          lte: quota.periodEnd,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10, // Last 10 requests
    })

    return c.json({
      currentPeriod: {
        screenshotsUsed: quota.requestsMade,
        screenshotsLimit: quota.requestsLimit,
        resetDate: quota.periodEnd.toISOString(),
      },
      total: {
        totalScreenshots,
        totalApiCalls,
      },
      recentRequests: usageLogs,
    })
  } catch (error: any) {
    logger.error('Error fetching usage:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /users/api-keys
 * List all API keys for current user
 */
usersRouter.get('/api-keys', async (c) => {
  try {
    const user = c.get('user')

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return c.json({ apiKeys })
  } catch (error: any) {
    logger.error('Error fetching API keys:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /users/api-keys
 * Create a new API key
 */
usersRouter.post('/api-keys', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const validation = createApiKeySchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const { name } = validation.data

    // Generate new API key
    const rawApiKey = generateApiKey()
    const hashedKey = await hashApiKey(rawApiKey)

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        key: hashedKey,
        keyPrefix: rawApiKey.substring(0, 12),
        name,
      },
    })

    logger.info('API key created', { userId: user.id, apiKeyId: apiKey.id })

    return c.json(
      {
        message: 'API key created successfully',
        apiKey: {
          id: apiKey.id,
          key: rawApiKey, // Return the raw key only once
          name: apiKey.name,
          createdAt: apiKey.createdAt,
          warning: 'Store this API key securely. You will not be able to see it again.',
        },
      },
      201
    )
  } catch (error: any) {
    logger.error('Error creating API key:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * DELETE /users/api-keys/:id
 * Revoke an API key
 */
usersRouter.delete('/api-keys/:id', async (c) => {
  try {
    const user = c.get('user')
    const keyId = c.req.param('id')

    // Check if key belongs to user
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        userId: user.id,
      },
    })

    if (!apiKey) {
      return c.json({ error: 'API key not found' }, 404)
    }

    if (apiKey.revokedAt) {
      return c.json({ error: 'API key is already revoked' }, 400)
    }

    // Revoke the key
    await prisma.apiKey.update({
      where: { id: keyId },
      data: {
        revokedAt: new Date(),
      },
    })

    logger.info('API key revoked', { userId: user.id, apiKeyId: keyId })

    return c.json({ message: 'API key revoked successfully' })
  } catch (error: any) {
    logger.error('Error revoking API key:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default usersRouter
