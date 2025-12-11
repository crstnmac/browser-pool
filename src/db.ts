import { logger } from './logger.js'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required to initialize Prisma')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({
  adapter,
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
  // @ts-ignore - Prisma event types are not exposed
  prisma.$on('query', (e: any) => {
    logger.debug('Prisma Query:', {
      query: e.query,
      params: e.params,
      duration: `${e.duration}ms`,
    })
  })
}

// @ts-ignore - Prisma event types are not exposed
prisma.$on('error', (e: any) => {
  logger.error('Prisma Error:', e)
})

// @ts-ignore - Prisma event types are not exposed
prisma.$on('info', (e: any) => {
  logger.info('Prisma Info:', e)
})

// @ts-ignore - Prisma event types are not exposed
prisma.$on('warn', (e: any) => {
  logger.warn('Prisma Warning:', e)
})

export { prisma }