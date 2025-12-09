import { Hono } from 'hono'
import type { HonoBindings } from '../types.js'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { logger } from '../logger.js'

const screenshotsRouter = new Hono<HonoBindings>()

/**
 * GET /screenshots
 * List user's screenshot history
 */
screenshotsRouter.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { limit = '20', offset = '0', url } = c.req.query()

    const where: any = {
      userId: user.id,
    }

    // Filter by URL if provided
    if (url) {
      where.url = {
        contains: url,
        mode: 'insensitive',
      }
    }

    // Get screenshots (without binary data for listing)
    const screenshots = await prisma.screenshot.findMany({
      where,
      select: {
        id: true,
        url: true,
        format: true,
        fileSize: true,
        metadata: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit),
      skip: parseInt(offset),
    })

    // Get total count
    const total = await prisma.screenshot.count({ where })

    return c.json({
      screenshots,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    })
  } catch (error: any) {
    logger.error('Error listing screenshots:', error)
    return c.json({ error: 'Failed to list screenshots' }, 500)
  }
})

/**
 * GET /screenshots/:id
 * Get a specific screenshot by ID
 */
screenshotsRouter.get('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.param()

    const screenshot = await prisma.screenshot.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!screenshot) {
      return c.json({ error: 'Screenshot not found' }, 404)
    }

    // Return the binary image data
    const contentType = screenshot.format === 'jpeg' ? 'image/jpeg' : 'image/png'
    return c.body(screenshot.imageData, 200, {
      'Content-Type': contentType,
      'Content-Length': screenshot.fileSize.toString(),
    })
  } catch (error: any) {
    logger.error('Error getting screenshot:', error)
    return c.json({ error: 'Failed to get screenshot' }, 500)
  }
})

/**
 * GET /screenshots/:id/metadata
 * Get screenshot metadata without binary data
 */
screenshotsRouter.get('/:id/metadata', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.param()

    const screenshot = await prisma.screenshot.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        url: true,
        format: true,
        fileSize: true,
        metadata: true,
        createdAt: true,
        expiresAt: true,
      },
    })

    if (!screenshot) {
      return c.json({ error: 'Screenshot not found' }, 404)
    }

    return c.json(screenshot)
  } catch (error: any) {
    logger.error('Error getting screenshot metadata:', error)
    return c.json({ error: 'Failed to get screenshot metadata' }, 500)
  }
})

/**
 * DELETE /screenshots/:id
 * Delete a screenshot
 */
screenshotsRouter.delete('/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { id } = c.req.param()

    // Check if screenshot exists and belongs to user
    const screenshot = await prisma.screenshot.findFirst({
      where: {
        id,
        userId: user.id,
      },
    })

    if (!screenshot) {
      return c.json({ error: 'Screenshot not found' }, 404)
    }

    // Delete the screenshot
    await prisma.screenshot.delete({
      where: { id },
    })

    logger.info('Screenshot deleted', { userId: user.id, screenshotId: id })

    return c.json({
      message: 'Screenshot deleted successfully',
    })
  } catch (error: any) {
    logger.error('Error deleting screenshot:', error)
    return c.json({ error: 'Failed to delete screenshot' }, 500)
  }
})

/**
 * DELETE /screenshots
 * Delete all screenshots for the user (or filtered by URL)
 */
screenshotsRouter.delete('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const { url } = c.req.query()

    const where: any = {
      userId: user.id,
    }

    if (url) {
      where.url = {
        contains: url,
        mode: 'insensitive',
      }
    }

    const result = await prisma.screenshot.deleteMany({ where })

    logger.info('Screenshots deleted', {
      userId: user.id,
      count: result.count,
      filter: url ? { url } : 'all',
    })

    return c.json({
      message: 'Screenshots deleted successfully',
      count: result.count,
    })
  } catch (error: any) {
    logger.error('Error deleting screenshots:', error)
    return c.json({ error: 'Failed to delete screenshots' }, 500)
  }
})

export default screenshotsRouter
