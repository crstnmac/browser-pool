import { Hono } from 'hono'
import type { HonoBindings } from '../types.js'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { getCurrentQuota } from '../auth.js'
import { logger } from '../logger.js'

const usersRouter = new Hono<HonoBindings>()

// Apply auth middleware to all routes
usersRouter.use('*', authMiddleware)

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

export default usersRouter
