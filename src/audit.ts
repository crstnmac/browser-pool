import { Context } from 'hono'
import { prisma } from './db.js'
import { logger } from './logger.js'

export async function logAudit(params: {
  userId?: string
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })

    logger.info('Audit log created', {
      action: params.action,
      userId: params.userId,
      resource: params.resource,
    })
  } catch (error) {
    logger.error('Failed to create audit log:', error)
    // Don't throw - audit logging should not break the main flow
  }
}

export async function logAuditFromContext(
  c: Context,
  action: string,
  resource?: string,
  resourceId?: string,
  details?: Record<string, any>
) {
  const user = c.get('user')
  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip')
  const userAgent = c.req.header('user-agent')

  await logAudit({
    userId: user?.id,
    action,
    resource,
    resourceId,
    details,
    ipAddress,
    userAgent,
  })
}
