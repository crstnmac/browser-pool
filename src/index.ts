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

// Import routes
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import adminRouter from './routes/admin.js'
import webhooksRouter from './routes/webhooks.js'
import subscriptionsRouter from './routes/subscriptions.js'
import dodoWebhooksRouter from './routes/dodo-webhooks.js'

const app = new Hono()
const browserPool = new BrowserPool(
  parseInt(process.env.BROWSER_POOL_SIZE || '5'),
  parseInt(process.env.BROWSER_IDLE_TIMEOUT || '300000')
)

// Global middleware
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

// Protected routes
app.route('/users', usersRouter)
app.route('/admin', adminRouter)
app.route('/webhooks', webhooksRouter)
app.route('/subscriptions', subscriptionsRouter)

// Dodo Payments webhooks (public, but verified)
app.route('/dodo-webhooks', dodoWebhooksRouter)

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

    const {url, cookieConsent = true} = await c.req.json()

    if (!url) {
      return c.json({error: 'URL is required'}, 400)
    }

    let page
    try {
      page = await browserPool.requirePage()

      // Clear cookies if needed
      await page.context().clearCookies()

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
      const screenshot = await page.screenshot({fullPage: true})

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

      return c.body(screenshot, 200, {
        'Content-Type': 'image/png',
      })
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
