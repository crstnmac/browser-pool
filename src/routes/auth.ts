import { Hono } from 'hono'
import { z } from 'zod'
import type { HonoBindings } from '../types.js'
import { prisma } from '../db.js'
import { hashPassword, verifyPassword, generateApiKey, hashApiKey } from '../auth.js'
import { logger } from '../logger.js'
import { emailService } from '../email.js'
import { logAudit } from '../audit.js'

const authRouter = new Hono<HonoBindings>()

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

/**
 * POST /auth/register
 * Register a new user
 */
authRouter.post('/register', async (c) => {
  try {
    const body = await c.req.json()
    const validation = registerSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const { email, password, name } = validation.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return c.json({ error: 'User with this email already exists' }, 409)
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    })

    // Generate initial API key
    const rawApiKey = generateApiKey()
    const hashedKey = await hashApiKey(rawApiKey)

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        key: hashedKey,
        keyPrefix: rawApiKey.substring(0, 12),
        name: 'Default Key',
      },
    })

    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.name, rawApiKey)

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'user.registered',
      resource: 'user',
      resourceId: user.id,
      ipAddress: c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    })

    logger.info('User registered', { userId: user.id, email: user.email })

    return c.json(
      {
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
        },
        apiKey: {
          id: apiKey.id,
          key: rawApiKey, // Return the raw key only once
          name: apiKey.name,
          message: 'Store this API key securely. You will not be able to see it again.',
        },
      },
      201
    )
  } catch (error: any) {
    logger.error('Registration error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /auth/login
 * Login user and get API keys
 */
authRouter.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    const validation = loginSchema.safeParse(body)

    if (!validation.success) {
      return c.json(
        {
          error: 'Validation failed',
          details: validation.error.issues,
        },
        400
      )
    }

    const { email, password } = validation.data

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        apiKeys: {
          where: {
            revokedAt: null,
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            lastUsedAt: true,
          },
        },
      },
    })

    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash)

    if (!isValid) {
      await logAudit({
        userId: user.id,
        action: 'user.login_failed',
        resource: 'user',
        resourceId: user.id,
        details: { reason: 'Invalid password' },
        ipAddress: c.req.header('x-forwarded-for'),
        userAgent: c.req.header('user-agent'),
      })
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      return c.json({ error: 'Account is suspended or deleted' }, 403)
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Log audit
    await logAudit({
      userId: user.id,
      action: 'user.login',
      resource: 'user',
      resourceId: user.id,
      ipAddress: c.req.header('x-forwarded-for'),
      userAgent: c.req.header('user-agent'),
    })

    logger.info('User logged in', { userId: user.id, email: user.email })

    // Get or create an API key for frontend use
    // Since we can't return raw keys from the database (they're hashed),
    // we'll create a new "session" key if the user has no active keys
    let apiKeyForFrontend: string | null = null
    
    if (user.apiKeys.length === 0) {
      // Create a new API key for the user
      const rawApiKey = generateApiKey()
      const hashedKey = await hashApiKey(rawApiKey)
      
      await prisma.apiKey.create({
        data: {
          userId: user.id,
          key: hashedKey,
          keyPrefix: rawApiKey.substring(0, 12),
          name: 'Session Key',
        },
      })
      
      apiKeyForFrontend = rawApiKey
      logger.info('Created new API key for user on login', { userId: user.id })
    } else {
      // User has API keys, but we can't return the raw key since it's hashed
      // For now, we'll create a new session key for frontend use
      // In a production system, you might want to use session-based auth instead
      const rawApiKey = generateApiKey()
      const hashedKey = await hashApiKey(rawApiKey)
      
      await prisma.apiKey.create({
        data: {
          userId: user.id,
          key: hashedKey,
          keyPrefix: rawApiKey.substring(0, 12),
          name: 'Session Key',
        },
      })
      
      apiKeyForFrontend = rawApiKey
      logger.info('Created session API key for user on login', { userId: user.id })
    }

    return c.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        isAdmin: user.isAdmin,
      },
      apiKey: apiKeyForFrontend,
      apiKeys: user.apiKeys,
      note: 'Use the API key above for authentication. If you need additional keys, use the /api-keys endpoint.',
    })
  } catch (error: any) {
    logger.error('Login error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default authRouter
