import { Hono } from 'hono'
import { z } from 'zod'
import crypto from 'crypto'
import type { HonoBindings } from '../types.js'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { logger } from '../logger.js'

const webhooksRouter = new Hono<HonoBindings>()

// Apply auth middleware to all routes
webhooksRouter.use('*', authMiddleware)

const createWebhookSchema = z.object({
  url: z.string().url('Invalid URL'),
  events: z
    .array(
      z.enum([
        'quota.exceeded',
        'quota.warning',
        'screenshot.completed',
        'screenshot.failed',
        'apikey.created',
        'apikey.revoked',
      ])
    )
    .min(1, 'At least one event is required'),
})

const updateWebhookSchema = z.object({
  url: z.string().url('Invalid URL').optional(),
  events: z
    .array(
      z.enum([
        'quota.exceeded',
        'quota.warning',
        'screenshot.completed',
        'screenshot.failed',
        'apikey.created',
        'apikey.revoked',
      ])
    )
    .min(1, 'At least one event is required')
    .optional(),
  isActive: z.boolean().optional(),
})

/**
 * GET /webhooks
 * List all webhooks for current user
 */
webhooksRouter.get('/', async (c) => {
  try {
    const user = c.get('user')

    const webhooks = await prisma.webhook.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        lastTriggeredAt: true,
        createdAt: true,
        updatedAt: true,
        // Don't return the secret
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return c.json({ webhooks })
  } catch (error: any) {
    logger.error('Error fetching webhooks:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /webhooks
 * Create a new webhook
 */
webhooksRouter.post('/', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const validation = createWebhookSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const { url, events } = validation.data

    // Generate webhook secret
    const secret = crypto.randomBytes(32).toString('hex')

    const webhook = await prisma.webhook.create({
      data: {
        userId: user.id,
        url,
        events,
        secret,
      },
      select: {
        id: true,
        url: true,
        events: true,
        secret: true, // Return secret only once
        isActive: true,
        createdAt: true,
      },
    })

    logger.info('Webhook created', { userId: user.id, webhookId: webhook.id })

    return c.json(
      {
        message: 'Webhook created successfully',
        webhook: {
          ...webhook,
          warning:
            'Store the secret securely. Use it to verify webhook signatures. You will not be able to see it again.',
        },
      },
      201
    )
  } catch (error: any) {
    logger.error('Error creating webhook:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /webhooks/:id
 * Get a specific webhook
 */
webhooksRouter.get('/:id', async (c) => {
  try {
    const user = c.get('user')
    const webhookId = c.req.param('id')

    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        userId: user.id,
      },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        lastTriggeredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!webhook) {
      return c.json({ error: 'Webhook not found' }, 404)
    }

    return c.json({ webhook })
  } catch (error: any) {
    logger.error('Error fetching webhook:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * PATCH /webhooks/:id
 * Update a webhook
 */
webhooksRouter.patch('/:id', async (c) => {
  try {
    const user = c.get('user')
    const webhookId = c.req.param('id')
    const body = await c.req.json()
    const validation = updateWebhookSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    // Check if webhook exists and belongs to user
    const existingWebhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        userId: user.id,
      },
    })

    if (!existingWebhook) {
      return c.json({ error: 'Webhook not found' }, 404)
    }

    const updates = validation.data

    const webhook = await prisma.webhook.update({
      where: { id: webhookId },
      data: updates,
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        lastTriggeredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    logger.info('Webhook updated', { userId: user.id, webhookId })

    return c.json({
      message: 'Webhook updated successfully',
      webhook,
    })
  } catch (error: any) {
    logger.error('Error updating webhook:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * DELETE /webhooks/:id
 * Delete a webhook
 */
webhooksRouter.delete('/:id', async (c) => {
  try {
    const user = c.get('user')
    const webhookId = c.req.param('id')

    // Check if webhook exists and belongs to user
    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        userId: user.id,
      },
    })

    if (!webhook) {
      return c.json({ error: 'Webhook not found' }, 404)
    }

    await prisma.webhook.delete({
      where: { id: webhookId },
    })

    logger.info('Webhook deleted', { userId: user.id, webhookId })

    return c.json({ message: 'Webhook deleted successfully' })
  } catch (error: any) {
    logger.error('Error deleting webhook:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /webhooks/:id/test
 * Send a test webhook
 */
webhooksRouter.post('/:id/test', async (c) => {
  try {
    const user = c.get('user')
    const webhookId = c.req.param('id')

    const webhook = await prisma.webhook.findFirst({
      where: {
        id: webhookId,
        userId: user.id,
      },
    })

    if (!webhook) {
      return c.json({ error: 'Webhook not found' }, 404)
    }

    // Import dynamically to avoid circular dependencies
    const { triggerWebhooks } = await import('../webhooks.js')

    // Send test webhook
    await triggerWebhooks(user.id, 'screenshot.completed', {
      test: true,
      message: 'This is a test webhook',
      timestamp: new Date().toISOString(),
    })

    return c.json({
      message: 'Test webhook sent successfully',
      note: 'Check your webhook endpoint to verify it was received',
    })
  } catch (error: any) {
    logger.error('Error sending test webhook:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default webhooksRouter
