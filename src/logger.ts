import winston from 'winston'
import { safeStringify } from './utils/sanitize.js'
// Configure log formats
const {combine, timestamp, printf, colorize, json} = winston.format

// Custom log format for console output
const consoleFormat = printf(({level, message, timestamp, ...metadata}) => {
  let metaStr = ''
  if (
    metadata &&
    Object.keys(metadata).length > 0 &&
    safeStringify(metadata) !== '{"service":"screenshot-api"}'
  ) {
    try {
      metaStr = safeStringify(metadata)
    } catch (error) {
      metaStr = '[Unable to stringify metadata]'
    }
  }
  return `${timestamp} [${level}]: ${message} ${metaStr}`
})

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  defaultMeta: {service: 'screenshot-api'},
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        consoleFormat
      ),
    }),

    // File transports for production
    ...(process.env.NODE_ENV === 'production'
      ? [
          // JSON format for error logs
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: combine(timestamp(), json()),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),

          // JSON format for all logs
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: combine(timestamp(), json()),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
        ]
      : []),
  ],
})

// Create a custom logger for request logging
export const httpLogger = {
  info: (message: string) => {
    logger.info(message)
  },
  error: (message: string, meta: any) => {
    logger.error(message, meta)
  },
}

// Add request context to logger
export function addRequestLogger(req: any) {
  const requestId =
    req.header('x-request-id') ??
    req.header('x-correlation-id') ??
    Math.random().toString(36).substring(2, 10)

  return {
    ...logger,
    info: (message: string, meta: any = {}) => {
      return logger.info(message, {
        requestId,
        ...meta,
      })
    },
    error: (message: string, meta: any = {}) => {
      return logger.error(message, {
        requestId,
        ...meta,
      })
    },
    warn: (message: string, meta: any = {}) => {
      return logger.warn(message, {
        requestId,
        ...meta,
      })
    },
    debug: (message: string, meta: any = {}) => {
      return logger.debug(message, {
        requestId,
        ...meta,
      })
    },
  }
}

// Export stream for Morgan integration if needed
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim())
  },
}

// Log uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({
    filename: 'logs/exceptions.log',
    format: combine(timestamp(), json()),
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  })
)

// Initialize logs directory in production
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs')
  if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs')
  }
}
