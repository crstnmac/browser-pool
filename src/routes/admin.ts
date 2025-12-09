import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoBindings } from '../types.js'
import { prisma } from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware.js'
import { logger } from '../logger.js'

const adminRouter = new Hono<HonoBindings>()

// Apply auth and admin middleware to all routes
adminRouter.use('*', authMiddleware, adminMiddleware)

const updateUserSchema = z.object({
  plan: z.enum(['FREE', 'PRO', 'ENTERPRISE']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  isAdmin: z.boolean().optional(),
})

/**
 * GET /admin/users
 * List all users with pagination
 */
adminRouter.get('/users', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          status: true,
          isAdmin: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              apiKeys: true,
              usageLogs: true,
            },
          },
        },
      }),
      prisma.user.count(),
    ])

    return c.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: unknown) {
    logger.error('Error fetching users:', { error })
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /admin/users/:id
 * Get detailed user information
 */
adminRouter.get('/users/:id', async (c) => {
  try {
    const userId = c.req.param('id')

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        apiKeys: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            lastUsedAt: true,
            revokedAt: true,
          },
        },
        quotas: {
          orderBy: {
            periodStart: 'desc',
          },
          take: 3,
        },
        _count: {
          select: {
            usageLogs: true,
          },
        },
      },
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Get recent usage logs
    const recentLogs = await prisma.usageLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return c.json({
      user,
      recentLogs,
    })
  } catch (error: unknown) {
    logger.error('Error fetching user details:', { error })
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * PATCH /admin/users/:id
 * Update user information
 */
adminRouter.patch('/users/:id', async (c) => {
  try {
    const userId = c.req.param('id')
    const body = await c.req.json()
    const validation = updateUserSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const updates = validation.data

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!existingUser) {
      return c.json({ error: 'User not found' }, 404)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updates,
    })

    const adminUser = c.get('user')

    logger.info('User updated by admin', {
      userId,
      updates,
      adminId: adminUser?.id ?? 'unknown',
    })

    return c.json({
      message: 'User updated successfully',
      user: updatedUser,
    })
  } catch (error: unknown) {
    logger.error('Error updating user:', { error })
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /admin/analytics
 * Get system-wide analytics
 */
adminRouter.get('/analytics', async (c) => {
  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      activeUsers,
      totalRequests,
      recentRequests,
      usersByPlan,
      avgResponseTime,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Active users (logged in last 30 days)
      prisma.user.count({
        where: {
          apiKeys: {
            some: {
              lastUsedAt: {
                gte: thirtyDaysAgo,
              },
            },
          },
        },
      }),

      // Total requests all time
      prisma.usageLog.count(),

      // Recent requests (last 30 days)
      prisma.usageLog.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),

      // Users by plan
      prisma.user.groupBy({
        by: ['plan'],
        _count: true,
      }),

      // Average response time (last 30 days)
      prisma.usageLog.aggregate({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        _avg: {
          responseTimeMs: true,
        },
      }),
    ])

    // Get error rate
    const errorCount = await prisma.usageLog.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
        statusCode: {
          gte: 400,
        },
      },
    })

    const errorRate = recentRequests > 0 ? (errorCount / recentRequests) * 100 : 0

    return c.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        byPlan: usersByPlan,
      },
      requests: {
        total: totalRequests,
        last30Days: recentRequests,
        errorRate: errorRate.toFixed(2) + '%',
      },
      performance: {
        avgResponseTime: avgResponseTime._avg.responseTimeMs?.toFixed(2) + 'ms' || 'N/A',
      },
    })
  } catch (error: unknown) {
    logger.error('Error fetching analytics:', { error })
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /admin/health
 * Detailed system health check
 */
adminRouter.get('/health', async (c) => {
  try {
    // Check database connection
    const dbHealthy = await prisma.$queryRaw`SELECT 1 as result`
      .then(() => true)
      .catch(() => false)

    // Get system stats
    const [userCount, apiKeyCount, usageLogCount] = await Promise.all([
      prisma.user.count(),
      prisma.apiKey.count(),
      prisma.usageLog.count(),
    ])

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbHealthy,
        users: userCount,
        apiKeys: apiKeyCount,
        usageLogs: usageLogCount,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    })
  } catch (error: unknown) {
    logger.error('Error checking health:', { error })
    return c.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      500
    )
  }
})

export default adminRouter
