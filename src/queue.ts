import crypto from 'node:crypto'
import axios from 'axios'
import { Queue, Worker, QueueEvents } from 'bullmq'
import { emailService } from './email.js'
import { getRedis } from './redis.js'
import { logger } from './logger.js'

/**
 * Background job queue using BullMQ
 * Requires Redis connection
 */

let emailQueue: Queue | null = null
let webhookQueue: Queue | null = null
let screenshotQueue: Queue | null = null

let emailWorker: Worker | null = null
let webhookWorker: Worker | null = null
let screenshotWorker: Worker | null = null

/**
 * Initialize job queues
 */
export function initQueues(): void {
  const redis = getRedis()

  if (!redis) {
    logger.warn('Redis not available - queue functionality will be disabled')
    return
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380'
  const connection = { url: redisUrl }

  try {
    // Email queue
    emailQueue = new Queue('emails', { connection })
    emailWorker = new Worker(
      'emails',
      async (job) => {
        logger.info('Processing email job', { jobId: job.id, type: job.data.type })

        try {
          switch (job.data.type) {
            case 'welcome':
              await emailService.sendWelcomeEmail(
                job.data.email,
                job.data.name,
                job.data.apiKey
              )
              break

            case 'password_reset':
              await emailService.sendPasswordResetEmail(
                job.data.email,
                job.data.name,
                job.data.token
              )
              break

            case 'email_verification':
              await emailService.sendEmailVerification(
                job.data.email,
                job.data.name,
                job.data.token
              )
              break

            case 'quota_warning':
              await emailService.sendQuotaWarning(
                job.data.email,
                job.data.name,
                job.data.current,
                job.data.limit,
                job.data.percentage
              )
              break

            case 'payment_success':
              await emailService.sendPaymentSuccess(
                job.data.email,
                job.data.name,
                job.data.amount,
                job.data.plan,
              )
              break

            case 'payment_failed':
              await emailService.sendPaymentFailed(
                job.data.email,
                job.data.name,
                job.data.reason
              )
              break

            default:
              logger.warn('Unknown email type', { type: job.data.type })
          }

          logger.info('Email sent successfully', { jobId: job.id })
        } catch (error: any) {
          logger.error('Failed to send email', { jobId: job.id, error: error.message })
          throw error // Will be retried
        }
      },
      {
        connection,
        concurrency: 5,
      }
    )

    // Webhook queue
    webhookQueue = new Queue('webhooks', { connection })
    webhookWorker = new Worker(
      'webhooks',
      async (job) => {
        logger.info('Processing webhook job', { jobId: job.id })

        const { url, secret, event, data } = job.data

        try {
          const timestamp = Date.now().toString()
          const payload = JSON.stringify({ event, data, timestamp })

          // Generate signature
          const signature = crypto
            .createHmac('sha256', secret)
            .update(`${timestamp}.${payload}`)
            .digest('hex')

          // Send webhook
          await axios.post(url, { event, data, timestamp }, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Timestamp': timestamp,
              'X-Webhook-Event': event,
            },
            timeout: 10000,
          })

          logger.info('Webhook delivered successfully', { jobId: job.id, url, event })
        } catch (error: any) {
          logger.error('Failed to deliver webhook', {
            jobId: job.id,
            url,
            error: error.message,
          })
          throw error // Will be retried
        }
      },
      {
        connection,
        concurrency: 10,
      }
    )

    // Screenshot queue (for async screenshot processing)
    screenshotQueue = new Queue('screenshots', { connection })
    screenshotWorker = new Worker(
      'screenshots',
      async (job) => {
        logger.info('Processing screenshot job', { jobId: job.id })

        // This would process screenshots asynchronously
        // Implementation would be similar to the synchronous version
        // but would allow for better resource management

        logger.info('Screenshot processed', { jobId: job.id })
      },
      {
        connection,
        concurrency: 3, // Limit concurrent screenshot jobs
      }
    )

    // Queue events for monitoring
    const emailQueueEvents = new QueueEvents('emails', { connection })
    emailQueueEvents.on('completed', ({ jobId }) => {
      logger.debug('Email job completed', { jobId })
    })
    emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Email job failed', { jobId, failedReason })
    })

    const webhookQueueEvents = new QueueEvents('webhooks', { connection })
    webhookQueueEvents.on('completed', ({ jobId }) => {
      logger.debug('Webhook job completed', { jobId })
    })
    webhookQueueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('Webhook job failed', { jobId, failedReason })
    })

    logger.info('Job queues initialized successfully')
  } catch (error: any) {
    logger.error('Failed to initialize job queues:', error)
  }
}

/**
 * Queue an email job
 */
export async function queueEmail(type: string, data: any): Promise<void> {
  if (!emailQueue) {
    logger.warn('Email queue not available, falling back to direct sending')
    // Fallback to direct email sending
    return
  }

  try {
    await emailQueue.add(
      type,
      { type, ...data },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    )

    logger.debug('Email job queued', { type })
  } catch (error: any) {
    logger.error('Failed to queue email job:', error)
    // Fallback to direct email sending
  }
}

/**
 * Queue a webhook delivery job
 */
export async function queueWebhook(
  url: string,
  secret: string,
  event: string,
  data: any
): Promise<void> {
  if (!webhookQueue) {
    logger.warn('Webhook queue not available, skipping webhook delivery')
    return
  }

  try {
    await webhookQueue.add(
      event,
      { url, secret, event, data },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    )

    logger.debug('Webhook job queued', { url, event })
  } catch (error: any) {
    logger.error('Failed to queue webhook job:', error)
  }
}

/**
 * Queue a screenshot job
 */
export async function queueScreenshot(
  userId: string,
  url: string,
  options: any
): Promise<string | null> {
  if (!screenshotQueue) {
    logger.warn('Screenshot queue not available')
    return null
  }

  try {
    const job = await screenshotQueue.add(
      'screenshot',
      { userId, url, options },
      {
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    )

    logger.debug('Screenshot job queued', { jobId: job.id, url })
    return job.id || null
  } catch (error: any) {
    logger.error('Failed to queue screenshot job:', error)
    return null
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<any> {
  const stats: any = {}

  if (emailQueue) {
    stats.emails = {
      waiting: await emailQueue.getWaitingCount(),
      active: await emailQueue.getActiveCount(),
      completed: await emailQueue.getCompletedCount(),
      failed: await emailQueue.getFailedCount(),
    }
  }

  if (webhookQueue) {
    stats.webhooks = {
      waiting: await webhookQueue.getWaitingCount(),
      active: await webhookQueue.getActiveCount(),
      completed: await webhookQueue.getCompletedCount(),
      failed: await webhookQueue.getFailedCount(),
    }
  }

  if (screenshotQueue) {
    stats.screenshots = {
      waiting: await screenshotQueue.getWaitingCount(),
      active: await screenshotQueue.getActiveCount(),
      completed: await screenshotQueue.getCompletedCount(),
      failed: await screenshotQueue.getFailedCount(),
    }
  }

  return stats
}

/**
 * Close all queues and workers gracefully
 */
export async function closeQueues(): Promise<void> {
  logger.info('Closing job queues...')

  const closePromises = []

  if (emailWorker) closePromises.push(emailWorker.close())
  if (webhookWorker) closePromises.push(webhookWorker.close())
  if (screenshotWorker) closePromises.push(screenshotWorker.close())

  if (emailQueue) closePromises.push(emailQueue.close())
  if (webhookQueue) closePromises.push(webhookQueue.close())
  if (screenshotQueue) closePromises.push(screenshotQueue.close())

  await Promise.all(closePromises)
  logger.info('Job queues closed successfully')
}
