import cron from 'node-cron'
import { prisma } from './db.js'
import { logger } from './logger.js'
import { BrowserPool } from './BrowserPool.js'
import { handleCookieBanners } from './CookieHandlers.js'
import handlePopups from './Popuphandlers.js'
import { applyScreenshotOptions, takeScreenshotWithOptions } from './screenshot-options.js'
import { triggerWebhooks } from './webhooks.js'

/**
 * Scheduler service for running scheduled screenshots
 */

const scheduledTasks = new Map<string, cron.ScheduledTask>()

/**
 * Calculate next run time based on cron expression
 */
function getNextRunTime(cronExpression: string): Date | null {
  try {
    // Simple approximation - for production use a proper cron parser
    // This will run every minute to check for due tasks
    return new Date(Date.now() + 60 * 1000)
  } catch (error) {
    logger.error('Error parsing cron expression:', error)
    return null
  }
}

/**
 * Execute a scheduled screenshot
 */
async function executeScheduledScreenshot(
  scheduleId: string,
  browserPool: BrowserPool
): Promise<void> {
  let page

  try {
    // Get the schedule
    const schedule = await prisma.scheduledScreenshot.findUnique({
      where: { id: scheduleId },
      include: { user: true },
    })

    if (!schedule || !schedule.isActive) {
      logger.info('Schedule not found or inactive, skipping', { scheduleId })
      return
    }

    logger.info('Executing scheduled screenshot', {
      scheduleId,
      userId: schedule.userId,
      url: schedule.url,
    })

    // Parse screenshot options
    const options = schedule.options ? JSON.parse(schedule.options) : {}

    page = await browserPool.requirePage()
    await page.context().clearCookies()

    // Apply screenshot options
    await applyScreenshotOptions(page, options)

    await page.goto(schedule.url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })

    // Handle cookie banners
    try {
      await handlePopups(page)
      await handleCookieBanners(page)
    } catch (e) {
      logger.warn('Error handling cookie consent:', { error: e })
    }

    const screenshot = await takeScreenshotWithOptions(page, options)

    // Save to history if requested
    if (schedule.saveHistory) {
      await prisma.screenshot.create({
        data: {
          userId: schedule.userId,
          url: schedule.url,
          imageData: new Uint8Array(screenshot),
          format: options.format || 'png',
          fileSize: screenshot.length,
          metadata: JSON.stringify(options),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        },
      })
    }

    // Update schedule
    await prisma.scheduledScreenshot.update({
      where: { id: scheduleId },
      data: {
        lastRunAt: new Date(),
        nextRunAt: getNextRunTime(schedule.cronExpression),
        runCount: { increment: 1 },
        lastError: null,
      },
    })

    // Trigger webhook if requested
    if (schedule.webhookOnComplete) {
      await triggerWebhooks(schedule.userId, 'scheduled_screenshot.completed', {
        scheduleId,
        scheduleName: schedule.name,
        url: schedule.url,
        timestamp: new Date().toISOString(),
      })
    }

    logger.info('Scheduled screenshot completed', {
      scheduleId,
      url: schedule.url,
    })
  } catch (error: any) {
    logger.error('Error executing scheduled screenshot:', {
      scheduleId,
      error: error.message,
    })

    // Update failure count
    try {
      await prisma.scheduledScreenshot.update({
        where: { id: scheduleId },
        data: {
          failureCount: { increment: 1 },
          lastError: error.message,
          nextRunAt: getNextRunTime('* * * * *'), // Try again in a minute
        },
      })
    } catch (updateError) {
      logger.error('Error updating schedule after failure:', updateError)
    }
  } finally {
    if (page) {
      try {
        await browserPool.releasePage(page)
      } catch (error) {
        logger.error('Error releasing page:', error)
      }
    }
  }
}

/**
 * Check and run due scheduled screenshots
 */
async function checkScheduledScreenshots(browserPool: BrowserPool): Promise<void> {
  try {
    const now = new Date()

    // Find schedules that are due to run
    const dueSchedules = await prisma.scheduledScreenshot.findMany({
      where: {
        isActive: true,
        OR: [
          { nextRunAt: { lte: now } },
          { nextRunAt: null }, // Never run before
        ],
      },
    })

    logger.debug(`Found ${dueSchedules.length} scheduled screenshots to run`)

    // Execute each schedule
    for (const schedule of dueSchedules) {
      // Run in background (don't await)
      executeScheduledScreenshot(schedule.id, browserPool).catch((error) => {
        logger.error('Uncaught error in scheduled screenshot:', error)
      })
    }
  } catch (error: any) {
    logger.error('Error checking scheduled screenshots:', error)
  }
}

/**
 * Initialize the scheduler
 */
export function initScheduler(browserPool: BrowserPool): void {
  logger.info('Initializing screenshot scheduler')

  // Run every minute to check for due screenshots
  const task = cron.schedule('* * * * *', () => {
    checkScheduledScreenshots(browserPool).catch((error) => {
      logger.error('Error in scheduler tick:', error)
    })
  })

  task.start()
  logger.info('Screenshot scheduler started')
}

/**
 * Schedule a new screenshot task
 */
export async function scheduleScreenshot(
  userId: string,
  name: string,
  url: string,
  cronExpression: string,
  options?: any,
  saveHistory = true,
  webhookOnComplete = false
): Promise<string> {
  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    throw new Error('Invalid cron expression')
  }

  const schedule = await prisma.scheduledScreenshot.create({
    data: {
      userId,
      name,
      url,
      cronExpression,
      options: options ? JSON.stringify(options) : null,
      saveHistory,
      webhookOnComplete,
      nextRunAt: getNextRunTime(cronExpression),
    },
  })

  logger.info('Screenshot scheduled', {
    scheduleId: schedule.id,
    userId,
    name,
    url,
    cronExpression,
  })

  return schedule.id
}

/**
 * Cancel a scheduled screenshot
 */
export async function cancelScheduledScreenshot(scheduleId: string): Promise<void> {
  await prisma.scheduledScreenshot.update({
    where: { id: scheduleId },
    data: { isActive: false },
  })

  logger.info('Scheduled screenshot canceled', { scheduleId })
}
