import { prisma } from '../db.js'
import { logger } from '../logger.js'
import { logAudit } from '../audit.js'

const MAX_ATTEMPTS = 5
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Check if account is currently locked
 */
export async function checkAccountLock(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true }
  })

  if (!user?.lockedUntil) return false

  // Check if still locked
  if (user.lockedUntil > new Date()) {
    return true
  }

  // Lock expired, clear it
  await prisma.user.update({
    where: { id: userId },
    data: {
      lockedUntil: null,
      failedLoginAttempts: 0
    }
  })

  return false
}

/**
 * Record a failed login attempt and lock account if necessary
 */
export async function recordFailedLogin(userId: string, ip?: string, userAgent?: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true, email: true }
  })

  if (!user) return

  const attempts = user.failedLoginAttempts + 1
  const shouldLock = attempts >= MAX_ATTEMPTS

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: attempts,
      ...(shouldLock ? {
        lockedUntil: new Date(Date.now() + LOCK_DURATION_MS)
      } : {})
    }
  })

  if (shouldLock) {
    logger.warn('Account locked due to failed login attempts', {
      userId,
      email: user.email,
      attempts
    })

    await logAudit({
      userId,
      action: 'account.locked',
      resource: 'user',
      resourceId: userId,
      details: {
        reason: 'too_many_failed_logins',
        attempts,
        lockDurationMinutes: LOCK_DURATION_MS / 60000
      },
      ipAddress: ip,
      userAgent
    })
  } else {
    logger.info('Failed login attempt recorded', {
      userId,
      attempts,
      remainingAttempts: MAX_ATTEMPTS - attempts
    })
  }
}

/**
 * Record successful login and reset failed attempts
 */
export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date()
    }
  })
}

/**
 * Get time remaining on account lock (in seconds)
 */
export async function getLockTimeRemaining(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true }
  })

  if (!user?.lockedUntil || user.lockedUntil <= new Date()) {
    return 0
  }

  return Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000)
}
