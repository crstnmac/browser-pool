import { Context } from 'hono'
import { logger } from './logger.js'

/**
 * Global error handler for uncaught errors
 */
export async function errorHandler(err: Error, c: Context) {
  const requestId = c.get('requestId') || 'unknown'

  logger.error('Unhandled error:', {
    requestId,
    error: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
  })

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production'

  return c.json(
    {
      error: 'Internal server error',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      requestId,
      ...(isProduction ? {} : { stack: err.stack }),
    },
    500
  )
}

/**
 * Not found handler
 */
export async function notFoundHandler(c: Context) {
  const requestId = c.get('requestId') || 'unknown'

  logger.warn('Route not found:', {
    requestId,
    path: c.req.path,
    method: c.req.method,
  })

  return c.json(
    {
      error: 'Not found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
      requestId,
    },
    404
  )
}

/**
 * Request ID middleware - adds unique ID to each request
 */
export async function requestIdMiddleware(c: Context, next: () => Promise<void>) {
  const requestId = c.req.header('x-request-id') || generateRequestId()
  c.set('requestId', requestId)
  c.header('x-request-id', requestId)

  const start = Date.now()

  await next()

  const duration = Date.now() - start

  logger.info('Request completed', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: `${duration}ms`,
  })
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}
