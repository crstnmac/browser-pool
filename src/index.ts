import {serve} from '@hono/node-server'
import {Hono} from 'hono'
import {logger as honoLogger} from 'hono/logger'
import {cors} from 'hono/cors'
import {BrowserPool} from './BrowserPool.js'
import {handleCookieBanners} from './CookieHandlers.js'
import handlePopups from './Popuphandlers.js'
import {logger} from './logger.js'
import {prisma} from './db.js'
import {authMiddleware, rateLimitMiddleware, quotaMiddleware} from './middleware.js'
import {incrementQuota} from './auth.js'
import {triggerWebhooks, checkAndTriggerQuotaWarning} from './webhooks.js'
import {initRedis, closeRedis} from './redis.js'
import {
  screenshotOptionsSchema,
  applyScreenshotOptions,
  takeScreenshotWithOptions,
  type ScreenshotOptions,
} from './screenshot-options.js'

// Import routes
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import adminRouter from './routes/admin.js'
import webhooksRouter from './routes/webhooks.js'
import subscriptionsRouter from './routes/subscriptions.js'
import dodoWebhooksRouter from './routes/dodo-webhooks.js'
import accountRouter from './routes/account.js'
import screenshotsRouter from './routes/screenshots.js'
import scheduledRouter from './routes/scheduled.js'

// Import scheduler
import {initScheduler} from './scheduler.js'

// Import error handling
import { errorHandler, notFoundHandler, requestIdMiddleware } from './errorHandler.js'

const app = new Hono()

// Register error handler
app.onError(errorHandler)

// Initialize Redis for distributed rate limiting (optional)
initRedis()

const browserPool = new BrowserPool(
  parseInt(process.env.BROWSER_POOL_SIZE || '5'),
  parseInt(process.env.BROWSER_IDLE_TIMEOUT || '300000')
)

// Initialize screenshot scheduler
initScheduler(browserPool)

// Global middleware
app.use('*', requestIdMiddleware) // Add request ID to all requests
app.use('*', honoLogger())
app.use(
  '*',
  cors({
    origin: String(process.env.ORIGIN_URL || '*'),
    maxAge: 600,
    credentials: true,
  })
)

// Public routes
app.get('/', (c) => {
  return c.json({
    name: 'Browser Pool SaaS',
    version: '1.0.0',
    description: 'Screenshot-as-a-Service with cookie consent handling',
    docs: '/api/docs',
  })
})

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

// Auth routes
app.route('/auth', authRouter)

// Account management
app.route('/account', accountRouter)

// Protected routes
app.route('/users', usersRouter)
app.route('/admin', adminRouter)
app.route('/webhooks', webhooksRouter)
app.route('/subscriptions', subscriptionsRouter)
app.route('/screenshots', screenshotsRouter)
app.route('/scheduled', scheduledRouter)

// Dodo Payments webhooks (public, but verified)
app.route('/dodo-webhooks', dodoWebhooksRouter)

// Bulk screenshot endpoint (protected)
app.post(
  '/screenshot/bulk',
  authMiddleware,
  async (c) => {
    const user = c.get('user')
    const apiKey = c.get('apiKey')

    try {
      const body = await c.req.json()
      const { urls, cookieConsent = true, options } = body

      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return c.json({ error: 'URLs array is required and must not be empty' }, 400)
      }

      if (urls.length > 10) {
        return c.json({ error: 'Maximum 10 URLs allowed per bulk request' }, 400)
      }

      // Parse and validate screenshot options
      let screenshotOpts: ScreenshotOptions = screenshotOptionsSchema.parse(options || {})


      // Check if user has enough quota for all URLs
      const currentQuota = await prisma.quota.findFirst({
        where: {
          userId: user.id,
          periodStart: { lte: new Date() },
          periodEnd: { gte: new Date() },
        },
      })

      if (currentQuota) {
        const remaining = currentQuota.requestsLimit - currentQuota.requestsMade
        if (remaining < urls.length) {
          return c.json(
            {
              error: 'Insufficient quota',
              message: `You need ${urls.length} requests but only have ${remaining} remaining`,
            },
            429
          )
        }
      }

      // Process screenshots in parallel (with concurrency limit)
      const results = await Promise.allSettled(
        urls.map(async (url: string) => {
          const startTime = Date.now()
          let page

          try {
            page = await browserPool.requirePage()

            await page.context().clearCookies()

            // Apply screenshot options (viewport, device, etc.)
            await applyScreenshotOptions(page, screenshotOpts)

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })

            if (cookieConsent) {
              try {
                await handlePopups(page)
                await handleCookieBanners(page)
              } catch (e) {
                logger.warn('Error handling cookie consent:', { error: e })
              }
            }

            const screenshot = await takeScreenshotWithOptions(page, screenshotOpts)

            // Increment quota
            await incrementQuota(user.id)

            // Log usage
            const responseTime = Date.now() - startTime
            await prisma.usageLog.create({
              data: {
                userId: user.id,
                apiKeyId: apiKey.id,
                endpoint: '/screenshot/bulk',
                urlRequested: url,
                statusCode: 200,
                responseTimeMs: responseTime,
              },
            })

            return {
              url,
              success: true,
              screenshot: screenshot.toString('base64'),
            }
          } catch (error: any) {
            logger.error('Bulk screenshot error:', { url, error })

            // Log error
            const responseTime = Date.now() - startTime
            await prisma.usageLog.create({
              data: {
                userId: user.id,
                apiKeyId: apiKey.id,
                endpoint: '/screenshot/bulk',
                urlRequested: url,
                statusCode: 500,
                responseTimeMs: responseTime,
                errorMessage: error.message,
              },
            })

            return {
              url,
              success: false,
              error: error.message,
            }
          } finally {
            if (page) {
              await browserPool.releasePage(page)
            }
          }
        })
      )

      // Format results
      const screenshots = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value
        } else {
          return {
            url: urls[index],
            success: false,
            error: result.reason?.message || 'Unknown error',
          }
        }
      })

      const successCount = screenshots.filter((s) => s.success).length
      const failCount = screenshots.length - successCount

      // Trigger webhook with summary
      await triggerWebhooks(user.id, 'screenshot.bulk_completed', {
        total: urls.length,
        successful: successCount,
        failed: failCount,
        timestamp: new Date().toISOString(),
      })

      return c.json({
        total: urls.length,
        successful: successCount,
        failed: failCount,
        screenshots,
      })
    } catch (error: any) {
      logger.error('Bulk screenshot request error:', error)
      return c.json({ error: 'Failed to process bulk screenshot request' }, 500)
    }
  }
)

// Screenshot endpoint (protected)
app.post(
  '/screenshot',
  authMiddleware,
  rateLimitMiddleware,
  quotaMiddleware,
  async (c) => {
    const startTime = Date.now()
    const user = c.get('user')
    const apiKey = c.get('apiKey')
    let statusCode = 200
    let errorMessage: string | undefined

    const {url, cookieConsent = true, options, saveHistory = false} = await c.req.json()

    if (!url) {
      return c.json({error: 'URL is required'}, 400)
    }

    // Parse and validate screenshot options
    let screenshotOpts: ScreenshotOptions
    try {
      screenshotOpts = screenshotOptionsSchema.parse(options || {})
    } catch (error: any) {
      return c.json({error: 'Invalid screenshot options', details: error.issues}, 400)
    }

    let page
    try {
      page = await browserPool.requirePage()

      // Clear cookies if needed
      await page.context().clearCookies()

      // Apply screenshot options (viewport, device, etc.)
      await applyScreenshotOptions(page, screenshotOpts)

      await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 60000})

      if (cookieConsent) {
        try {
          await handlePopups(page)
          await handleCookieBanners(page)
        } catch (e) {
          logger.warn('Error handling cookie consent:', {error: e})
        }
      }

      // Take screenshot after all tasks
      const screenshot = await takeScreenshotWithOptions(page, screenshotOpts)

      // Increment quota
      await incrementQuota(user.id)

      // Get updated quota to check for warnings
      const quota = await prisma.quota.findFirst({
        where: {
          userId: user.id,
          periodStart: {lte: new Date()},
          periodEnd: {gte: new Date()},
        },
      })

      if (quota) {
        await checkAndTriggerQuotaWarning(
          user.id,
          quota.requestsMade,
          quota.requestsLimit
        )
      }

      // Trigger success webhook
      await triggerWebhooks(user.id, 'screenshot.completed', {
        url,
        timestamp: new Date().toISOString(),
      })

      // Log usage
      const responseTime = Date.now() - startTime
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          apiKeyId: apiKey.id,
          endpoint: '/screenshot',
          urlRequested: url,
          statusCode: 200,
          responseTimeMs: responseTime,
        },
      })

      // Save to history if requested
      let screenshotId: string | undefined
      if (saveHistory) {
        try {
          const saved = await prisma.screenshot.create({
            data: {
              userId: user.id,
              url,
              imageData: screenshot,
              format: screenshotOpts.format,
              fileSize: screenshot.length,
              metadata: JSON.stringify(screenshotOpts),
              // Set expiration to 30 days by default
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          })
          screenshotId = saved.id
          logger.info('Screenshot saved to history', {
            userId: user.id,
            screenshotId: saved.id,
            url,
          })
        } catch (error: any) {
          logger.error('Failed to save screenshot to history:', error)
          // Continue anyway - don't fail the request
        }
      }

      const contentType = screenshotOpts.format === 'jpeg' ? 'image/jpeg' : 'image/png'
      const headers: Record<string, string> = {
        'Content-Type': contentType,
      }

      // Include screenshot ID in header if saved
      if (screenshotId) {
        headers['X-Screenshot-Id'] = screenshotId
      }

      return c.body(screenshot, 200, headers)
    } catch (error: any) {
      statusCode = 500
      errorMessage = error.message
      logger.error('Screenshot error:', {error})

      // Trigger failure webhook
      await triggerWebhooks(user.id, 'screenshot.failed', {
        url,
        error: error.message,
        timestamp: new Date().toISOString(),
      })

      // Log error
      const responseTime = Date.now() - startTime
      await prisma.usageLog.create({
        data: {
          userId: user.id,
          apiKeyId: apiKey.id,
          endpoint: '/screenshot',
          urlRequested: url,
          statusCode,
          responseTimeMs: responseTime,
          errorMessage,
        },
      })

      return c.json({error: 'Failed to capture screenshot'}, 500)
    } finally {
      if (page) {
        await browserPool.releasePage(page)
      }
    }
  }
)

// 404 handler (must be last)
app.notFound(notFoundHandler)

const port = parseInt(process.env.PORT || '3000')

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info(`🚀 Browser Pool SaaS running on http://localhost:${info.port}`)
    logger.info(`📖 API Documentation: http://localhost:${info.port}/`)
    logger.info(`🏥 Health Check: http://localhost:${info.port}/health`)
  }
)

// Handle shutdown gracefully
async function shutdown() {
  logger.info('Shutting down gracefully...')

  try {
    // Close browser pool
    await browserPool.close()
    logger.info('Browser pool closed')

    // Close Redis connection
    await closeRedis()
    logger.info('Redis connection closed')

    // Disconnect Prisma
    await prisma.$disconnect()
    logger.info('Database disconnected')

    logger.info('Shutdown complete')
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown:', error)
    process.exit(1)
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
