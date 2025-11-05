import { Hono } from 'hono'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { hashPassword, verifyPassword } from '../auth.js'
import { emailService } from '../email.js'
import { logger } from '../logger.js'
import { logAuditFromContext, logAudit } from '../audit.js'

const accountRouter = new Hono()

const requestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
})

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
})

/**
 * POST /account/request-password-reset
 * Request a password reset email
 */
accountRouter.post('/request-password-reset', async (c) => {
  try {
    const body = await c.req.json()
    const validation = requestPasswordResetSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const { email } = validation.data

    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      logger.info('Password reset requested for non-existent email', { email })
      return c.json({
        message: 'If that email exists, a password reset link has been sent',
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiry: resetExpiry,
      },
    })

    // Send reset email
    await emailService.sendPasswordResetEmail(user.email, user.name, resetToken)

    await logAudit({
      userId: user.id,
      action: 'password_reset.requested',
      resource: 'user',
      resourceId: user.id,
      ipAddress: c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    })

    logger.info('Password reset email sent', { userId: user.id })

    return c.json({
      message: 'If that email exists, a password reset link has been sent',
    })
  } catch (error: any) {
    logger.error('Error requesting password reset:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /account/reset-password
 * Reset password using token
 */
accountRouter.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json()
    const validation = resetPasswordSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const { token, newPassword } = validation.data

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      return c.json(
        {
          error: 'Invalid or expired reset token',
        },
        400
      )
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword)

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    })

    await logAudit({
      userId: user.id,
      action: 'password.reset',
      resource: 'user',
      resourceId: user.id,
      ipAddress: c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    })

    logger.info('Password reset successful', { userId: user.id })

    return c.json({
      message: 'Password reset successful',
    })
  } catch (error: any) {
    logger.error('Error resetting password:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /account/change-password
 * Change password (authenticated)
 */
accountRouter.post('/change-password', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const validation = changePasswordSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const { currentPassword, newPassword } = validation.data

    // Verify current password
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
    })

    if (!fullUser) {
      return c.json({ error: 'User not found' }, 404)
    }

    const isValid = await verifyPassword(currentPassword, fullUser.passwordHash)

    if (!isValid) {
      await logAuditFromContext(c, 'password.change_failed', 'user', user.id, {
        reason: 'Invalid current password',
      })
      return c.json({ error: 'Current password is incorrect' }, 400)
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    await logAuditFromContext(c, 'password.changed', 'user', user.id)

    logger.info('Password changed', { userId: user.id })

    return c.json({
      message: 'Password changed successfully',
    })
  } catch (error: any) {
    logger.error('Error changing password:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /account/request-email-verification
 * Request email verification (authenticated)
 */
accountRouter.post('/request-email-verification', authMiddleware, async (c) => {
  try {
    const user = c.get('user')

    if (user.emailVerified) {
      return c.json({ error: 'Email already verified' }, 400)
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
    })

    // Send verification email
    await emailService.sendEmailVerification(
      user.email,
      user.name,
      verificationToken
    )

    await logAuditFromContext(c, 'email_verification.requested', 'user', user.id)

    logger.info('Email verification sent', { userId: user.id })

    return c.json({
      message: 'Verification email sent',
    })
  } catch (error: any) {
    logger.error('Error requesting email verification:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /account/verify-email
 * Verify email using token
 */
accountRouter.post('/verify-email', async (c) => {
  try {
    const { token } = await c.req.json()

    if (!token) {
      return c.json({ error: 'Token is required' }, 400)
    }

    // Find user with valid verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      return c.json(
        {
          error: 'Invalid or expired verification token',
        },
        400
      )
    }

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    })

    await logAudit({
      userId: user.id,
      action: 'email.verified',
      resource: 'user',
      resourceId: user.id,
      ipAddress: c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    })

    logger.info('Email verified', { userId: user.id })

    return c.json({
      message: 'Email verified successfully',
    })
  } catch (error: any) {
    logger.error('Error verifying email:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * PATCH /account/profile
 * Update user profile (authenticated)
 */
accountRouter.patch('/profile', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const validation = updateProfileSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const updates = validation.data

    // If email is being changed, require re-verification
    if (updates.email && updates.email !== user.email) {
      // Check if email is already taken
      const existing = await prisma.user.findUnique({
        where: { email: updates.email },
      })

      if (existing) {
        return c.json({ error: 'Email already in use' }, 400)
      }

      updates['emailVerified'] = false
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updates as any,
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        plan: true,
        status: true,
      },
    })

    await logAuditFromContext(c, 'profile.updated', 'user', user.id, updates)

    logger.info('Profile updated', { userId: user.id })

    return c.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    })
  } catch (error: any) {
    logger.error('Error updating profile:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /account/export
 * Export user data (GDPR compliance)
 */
accountRouter.get('/export', authMiddleware, async (c) => {
  try {
    const user = c.get('user')

    // Get all user data
    const [userData, apiKeys, usageLogs, quotas, subscriptions, payments, webhooks] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            status: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.apiKey.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            name: true,
            createdAt: true,
            lastUsedAt: true,
            revokedAt: true,
          },
        }),
        prisma.usageLog.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            endpoint: true,
            urlRequested: true,
            statusCode: true,
            responseTimeMs: true,
            createdAt: true,
          },
        }),
        prisma.quota.findMany({
          where: { userId: user.id },
        }),
        prisma.subscription.findMany({
          where: { userId: user.id },
        }),
        prisma.payment.findMany({
          where: { userId: user.id },
        }),
        prisma.webhook.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            url: true,
            events: true,
            isActive: true,
            createdAt: true,
          },
        }),
      ])

    const exportData = {
      user: userData,
      apiKeys,
      usageLogs,
      quotas,
      subscriptions,
      payments,
      webhooks,
      exportedAt: new Date().toISOString(),
    }

    await logAuditFromContext(c, 'data.exported', 'user', user.id)

    return c.json(exportData)
  } catch (error: any) {
    logger.error('Error exporting data:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * DELETE /account
 * Delete user account (GDPR compliance)
 */
accountRouter.delete('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { confirmEmail } = await c.req.json()

    if (confirmEmail !== user.email) {
      return c.json(
        {
          error: 'Email confirmation does not match',
        },
        400
      )
    }

    // Cancel active subscriptions first
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: {
          in: ['ACTIVE', 'TRIALING'],
        },
      },
    })

    // TODO: Cancel subscriptions in Dodo Payments
    // for (const sub of activeSubscriptions) {
    //   await dodoPayments.cancelSubscription(sub.dodoSubscriptionId, false)
    // }

    await logAudit({
      userId: user.id,
      action: 'account.deleted',
      resource: 'user',
      resourceId: user.id,
      details: { email: user.email, name: user.name },
      ipAddress: c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    })

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id: user.id },
    })

    logger.info('Account deleted', { userId: user.id, email: user.email })

    return c.json({
      message: 'Account deleted successfully',
    })
  } catch (error: any) {
    logger.error('Error deleting account:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default accountRouter
