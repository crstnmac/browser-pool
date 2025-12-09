import { Hono } from 'hono'
import { z } from 'zod'
import cron from 'node-cron'
import type { HonoBindings } from '../types.js'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { logger } from '../logger.js'
import { scheduleScreenshot, cancelScheduledScreenshot } from '../scheduler.js'
import { screenshotOptionsSchema } from '../screenshot-options.js'

const scheduledRouter = new Hono<HonoBindings>()

const createScheduleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Invalid URL'),
  cronExpression: z.string().min(1, 'Cron expression is required'),
  options: screenshotOptionsSchema.optional(),
  saveHistory: z.boolean().default(true),
  webhookOnComplete: z.boolean().default(false),
})

const updateScheduleSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  cronExpression: z.string().min(1).optional(),
  options: screenshotOptionsSchema.optional(),
  isActive: z.boolean().optional(),
  saveHistory: z.boolean().optional(),
  webhookOnComplete: z.boolean().optional(),
})

/**
 * POST /scheduled
 * Create a new scheduled screenshot
 */
scheduledRouter.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const validation = createScheduleSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const { name, url, cronExpression, options, saveHistory, webhookOnComplete } =
      validation.data

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      return c.json({ error: 'Invalid cron expression' }, 400)
    }

    // Check user's plan limits
    const existingSchedules = await prisma.scheduledScreenshot.count({
      where: { userId: user.id, isActive: true },
    })

    const limits = {
      FREE: 0,
      PRO: 5,
      ENTERPRISE: 50,
    }

    const limit = limits[user.plan]

    if (existingSchedules >= limit) {
      return c.json(
        {
          error: 'Schedule limit reached',
          message: `Your ${user.plan} plan allows up to ${limit} scheduled screenshots`,
        },
        403
      )
    }

    const scheduleId = await scheduleScreenshot(
      user.id,
      name,
      url,
      cronExpression,
      options,
      saveHistory,
      webhookOnComplete
    )

    const schedule = await prisma.scheduledScreenshot.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        name: true,
        url: true,
        cronExpression: true,
        isActive: true,
        saveHistory: true,
        webhookOnComplete: true,
        lastRunAt: true,
        nextRunAt: true,
        runCount: true,
        failureCount: true,
        createdAt: true,
      },
    })

    return c.json(schedule, 201)
  } catch (error: any) {
    logger.error('Error creating scheduled screenshot:', error)
    return c.json({ error: 'Failed to create scheduled screenshot' }, 500)
  }
})

/**
 * GET /scheduled
 * List user's scheduled screenshots
 */
scheduledRouter.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { active } = c.req.query()

    const where: any = { userId: user.id }

    if (active !== undefined) {
      where.isActive = active === 'true'
    }

    const schedules = await prisma.scheduledScreenshot.findMany({
      where,
      select: {
        id: true,
        name: true,
        url: true,
        cronExpression: true,
        isActive: true,
        saveHistory: true,
        webhookOnComplete: true,
        lastRunAt: true,
        nextRunAt: true,
        runCount: true,
        failureCount: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return c.json({ schedules })
  } catch (error: any) {
    logger.error('Error listing scheduled screenshots:', error)
    return c.json({ error: 'Failed to list scheduled screenshots' }, 500)
  }
})

/**
 * GET /scheduled/:id
 * Get a specific scheduled screenshot
 */
scheduledRouter.get('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.param()

    const schedule = await prisma.scheduledScreenshot.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!schedule) {
      return c.json({ error: 'Scheduled screenshot not found' }, 404)
    }

    return c.json(schedule)
  } catch (error: any) {
    logger.error('Error getting scheduled screenshot:', error)
    return c.json({ error: 'Failed to get scheduled screenshot' }, 500)
  }
})

/**
 * PATCH /scheduled/:id
 * Update a scheduled screenshot
 */
scheduledRouter.patch('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.param()
    const body = await c.req.json()
    const validation = updateScheduleSchema.safeParse(body)

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

    // Validate cron expression if provided
    if (updates.cronExpression && !cron.validate(updates.cronExpression)) {
      return c.json({ error: 'Invalid cron expression' }, 400)
    }

    // Check if schedule exists and belongs to user
    const existing = await prisma.scheduledScreenshot.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!existing) {
      return c.json({ error: 'Scheduled screenshot not found' }, 404)
    }

    // Prepare update data
    const updateData: any = {}

    if (updates.name) updateData.name = updates.name
    if (updates.url) updateData.url = updates.url
    if (updates.cronExpression) {
      updateData.cronExpression = updates.cronExpression
      // Recalculate next run time (simplified)
      updateData.nextRunAt = new Date(Date.now() + 60 * 1000)
    }
    if (updates.options !== undefined) {
      updateData.options = JSON.stringify(updates.options)
    }
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive
    if (updates.saveHistory !== undefined) updateData.saveHistory = updates.saveHistory
    if (updates.webhookOnComplete !== undefined) {
      updateData.webhookOnComplete = updates.webhookOnComplete
    }

    const schedule = await prisma.scheduledScreenshot.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        url: true,
        cronExpression: true,
        isActive: true,
        saveHistory: true,
        webhookOnComplete: true,
        lastRunAt: true,
        nextRunAt: true,
        runCount: true,
        failureCount: true,
        updatedAt: true,
      },
    })

    return c.json(schedule)
  } catch (error: any) {
    logger.error('Error updating scheduled screenshot:', error)
    return c.json({ error: 'Failed to update scheduled screenshot' }, 500)
  }
})

/**
 * DELETE /scheduled/:id
 * Delete a scheduled screenshot
 */
scheduledRouter.delete('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.param()

    // Check if schedule exists and belongs to user
    const schedule = await prisma.scheduledScreenshot.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!schedule) {
      return c.json({ error: 'Scheduled screenshot not found' }, 404)
    }

    // Delete the schedule
    await prisma.scheduledScreenshot.delete({
      where: { id },
    })

    logger.info('Scheduled screenshot deleted', {
      userId: user.id,
      scheduleId: id,
    })

    return c.json({
      message: 'Scheduled screenshot deleted successfully',
    })
  } catch (error: any) {
    logger.error('Error deleting scheduled screenshot:', error)
    return c.json({ error: 'Failed to delete scheduled screenshot' }, 500)
  }
})

/**
 * POST /scheduled/:id/pause
 * Pause a scheduled screenshot
 */
scheduledRouter.post('/:id/pause', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.param()

    const schedule = await prisma.scheduledScreenshot.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!schedule) {
      return c.json({ error: 'Scheduled screenshot not found' }, 404)
    }

    await cancelScheduledScreenshot(id)

    return c.json({
      message: 'Scheduled screenshot paused',
    })
  } catch (error: any) {
    logger.error('Error pausing scheduled screenshot:', error)
    return c.json({ error: 'Failed to pause scheduled screenshot' }, 500)
  }
})

/**
 * POST /scheduled/:id/resume
 * Resume a paused scheduled screenshot
 */
scheduledRouter.post('/:id/resume', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.param()

    const schedule = await prisma.scheduledScreenshot.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!schedule) {
      return c.json({ error: 'Scheduled screenshot not found' }, 404)
    }

    await prisma.scheduledScreenshot.update({
      where: { id },
      data: {
        isActive: true,
        nextRunAt: new Date(Date.now() + 60 * 1000),
      },
    })

    return c.json({
      message: 'Scheduled screenshot resumed',
    })
  } catch (error: any) {
    logger.error('Error resuming scheduled screenshot:', error)
    return c.json({ error: 'Failed to resume scheduled screenshot' }, 500)
  }
})

export default scheduledRouter
