import crypto from 'crypto'
import axios from 'axios'
import { prisma } from './db.js'
import { logger } from './logger.js'

export type WebhookEvent =
  | 'quota.exceeded'
  | 'quota.warning'
  | 'screenshot.completed'
  | 'screenshot.failed'
  | 'screenshot.bulk_completed'
  | 'apikey.created'
  | 'apikey.revoked'
  | 'scheduled_screenshot.completed'
  | 'scheduled_screenshot.failed'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  data: any
  userId: string
}

/**
 * Generate webhook signature for verification
 */
function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Send webhook to a specific URL
 */
async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  secret: string
): Promise<boolean> {
  try {
    const payloadString = JSON.stringify(payload)
    const signature = generateSignature(payloadString, secret)

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.event,
      },
      timeout: 10000, // 10 second timeout
    })

    if (response.status >= 200 && response.status < 300) {
      logger.info('Webhook sent successfully', {
        url,
        event: payload.event,
        status: response.status,
      })
      return true
    } else {
      logger.warn('Webhook returned non-2xx status', {
        url,
        event: payload.event,
        status: response.status,
      })
      return false
    }
  } catch (error: any) {
    logger.error('Error sending webhook', {
      url,
      event: payload.event,
      error: error.message,
    })
    return false
  }
}

/**
 * Trigger webhooks for a user based on an event
 */
export async function triggerWebhooks(
  userId: string,
  event: WebhookEvent,
  data: any
): Promise<void> {
  try {
    // Get all active webhooks for this user that listen to this event
    const webhooks = await prisma.webhook.findMany({
      where: {
        userId,
        isActive: true,
        events: {
          has: event,
        },
      },
    })

    if (webhooks.length === 0) {
      logger.debug('No active webhooks found for event', { userId, event })
      return
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
      userId,
    }

    // Send webhooks in parallel
    const promises = webhooks.map(async (webhook) => {
      const success = await sendWebhook(webhook.url, payload, webhook.secret)

      // Update last triggered time
      if (success) {
        await prisma.webhook.update({
          where: { id: webhook.id },
          data: { lastTriggeredAt: new Date() },
        })
      }
    })

    await Promise.allSettled(promises)
    logger.info('Webhooks triggered', {
      userId,
      event,
      webhookCount: webhooks.length,
    })
  } catch (error: any) {
    logger.error('Error triggering webhooks', {
      userId,
      event,
      error: error.message,
    })
  }
}

/**
 * Helper to trigger quota warning webhook (when 80% used)
 */
export async function checkAndTriggerQuotaWarning(
  userId: string,
  used: number,
  limit: number
): Promise<void> {
  const percentage = (used / limit) * 100

  if (percentage >= 80 && percentage < 100) {
    await triggerWebhooks(userId, 'quota.warning', {
      used,
      limit,
      remaining: limit - used,
      percentage: percentage.toFixed(2),
    })
  } else if (percentage >= 100) {
    await triggerWebhooks(userId, 'quota.exceeded', {
      used,
      limit,
      percentage: percentage.toFixed(2),
    })
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(payload, secret)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
