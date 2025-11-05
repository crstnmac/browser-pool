import { PrismaClient } from '@prisma/client'
import { logger } from './logger.js'

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
      {
        emit: 'event',
        level: 'error',
      },
      {
        emit: 'event',
        level: 'info',
      },
      {
        emit: 'event',
        level: 'warn',
      },
    ],
  })

// Log Prisma queries in development
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e: any) => {
    logger.debug('Prisma Query:', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    })
  })
}

prisma.$on('error', (e: any) => {
  logger.error('Prisma Error:', e)
})

prisma.$on('info', (e: any) => {
  logger.info('Prisma Info:', e)
})

prisma.$on('warn', (e: any) => {
  logger.warn('Prisma Warning:', e)
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
