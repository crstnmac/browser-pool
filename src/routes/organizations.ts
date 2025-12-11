import { Hono } from 'hono'
import type { HonoBindings } from '../types.js'
import { prisma } from '../db.js'
import { authMiddleware } from '../middleware.js'
import { logger } from '../logger.js'
import { z } from 'zod'

const organizationsRouter = new Hono<HonoBindings>()

// Apply auth middleware to all routes
organizationsRouter.use('*', authMiddleware)

// Validation schemas
const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
})

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  newSlug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/).optional(),
})

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'admin']).default('member'),
})

const updateMemberRoleSchema = z.object({
  role: z.enum(['member', 'admin']),
})

/**
 * GET /organizations
 * Get organizations for the current user
 */
organizationsRouter.get('/', async (c) => {
  try {
    const user = c.get('user')

    const organizations = await prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return c.json({ organizations })
  } catch (error: any) {
    logger.error('Error fetching organizations:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /organizations
 * Create a new organization
 */
organizationsRouter.post('/', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const { name, slug } = createOrganizationSchema.parse(body)

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    })

    if (existingOrg) {
      return c.json({ error: 'Organization slug is already taken' }, 400)
    }

    // Create organization and add creator as admin
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    })

    // Add creator as admin member
    await prisma.member.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: 'admin',
      },
    })

    return c.json({ organization }, 201)
  } catch (error: any) {
    logger.error('Error creating organization:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /organizations/:slug
 * Get organization details
 */
organizationsRouter.get('/:slug', async (c) => {
  try {
    const user = c.get('user')
    const slug = c.req.param('slug')

    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        invitations: {
          where: {
            status: 'pending',
          },
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    })

    if (!organization) {
      return c.json({ error: 'Organization not found' }, 404)
    }

    // Check if user is a member
    const isMember = organization.members.some(member => member.userId === user.id)
    if (!isMember) {
      return c.json({ error: 'Access denied' }, 403)
    }

    return c.json({ organization })
  } catch (error: any) {
    logger.error('Error fetching organization:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * PUT /organizations/:slug
 * Update organization details
 */
organizationsRouter.put('/:slug', async (c) => {
  try {
    const user = c.get('user')
    const slug = c.req.param('slug')
    const body = await c.req.json()
    const { name, newSlug } = updateOrganizationSchema.parse(body)

    // Check if user is admin of the organization
    const membership = await prisma.member.findFirst({
      where: {
        organization: { slug },
        userId: user.id,
        role: 'admin',
      },
    })

    if (!membership) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // Check if new slug is already taken (if provided)
    if (newSlug && newSlug !== slug) {
      const existingOrg = await prisma.organization.findUnique({
        where: { slug: newSlug },
      })
      if (existingOrg) {
        return c.json({ error: 'Organization slug is already taken' }, 400)
      }
    }

    const updateData: any = { name }
    if (newSlug && newSlug !== slug) {
      updateData.slug = newSlug
    }

    const organization = await prisma.organization.update({
      where: { slug },
      data: updateData,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    })

    return c.json({ organization })
  } catch (error: any) {
    logger.error('Error updating organization:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * DELETE /organizations/:slug
 * Delete organization
 */
organizationsRouter.delete('/:slug', async (c) => {
  try {
    const user = c.get('user')
    const slug = c.req.param('slug')

    // Check if user is admin of the organization
    const membership = await prisma.member.findFirst({
      where: {
        organization: { slug },
        userId: user.id,
        role: 'admin',
      },
    })

    if (!membership) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // Delete organization (cascade will handle members and invitations)
    await prisma.organization.delete({
      where: { slug },
    })

    return c.json({ message: 'Organization deleted successfully' })
  } catch (error: any) {
    logger.error('Error deleting organization:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /organizations/:slug/invite
 * Invite a user to the organization
 */
organizationsRouter.post('/:slug/invite', async (c) => {
  try {
    const user = c.get('user')
    const slug = c.req.param('slug')
    const body = await c.req.json()
    const { email, role } = inviteUserSchema.parse(body)

    // Check if user is admin or member of the organization
    const membership = await prisma.member.findFirst({
      where: {
        organization: { slug },
        userId: user.id,
      },
    })

    if (!membership) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // Check if user is already a member
    const existingMember = await prisma.member.findFirst({
      where: {
        organization: { slug },
        user: { email },
      },
    })

    if (existingMember) {
      return c.json({ error: 'User is already a member of this organization' }, 400)
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        organization: { slug },
        email,
        status: 'pending',
      },
    })

    if (existingInvitation) {
      return c.json({ error: 'User has already been invited' }, 400)
    }

    // Find user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    })

    // Create invitation
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    const invitation = await prisma.invitation.create({
      data: {
        organizationId: membership.organizationId,
        email,
        role,
        expiresAt,
        inviterId: user.id,
      },
    })

    // TODO: Send email invitation

    return c.json({ invitation }, 201)
  } catch (error: any) {
    logger.error('Error inviting user:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /organizations/:slug/invitations/:invitationId/accept
 * Accept an organization invitation
 */
organizationsRouter.post('/:slug/invitations/:invitationId/accept', async (c) => {
  try {
    const user = c.get('user')
    const slug = c.req.param('slug')
    const invitationId = c.req.param('invitationId')

    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: true,
      },
    })

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404)
    }

    if (invitation.organization.slug !== slug) {
      return c.json({ error: 'Invalid invitation' }, 400)
    }

    if (invitation.email !== user.email) {
      return c.json({ error: 'Invitation is not for this user' }, 403)
    }

    if (invitation.status !== 'pending') {
      return c.json({ error: 'Invitation is no longer valid' }, 400)
    }

    if (new Date() > invitation.expiresAt) {
      return c.json({ error: 'Invitation has expired' }, 400)
    }

    // Check if user is already a member
    const existingMember = await prisma.member.findFirst({
      where: {
        organizationId: invitation.organizationId,
        userId: user.id,
      },
    })

    if (existingMember) {
      return c.json({ error: 'User is already a member of this organization' }, 400)
    }

    // Accept invitation
    await prisma.$transaction(async (tx) => {
      // Create membership
      await tx.member.create({
        data: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role || 'member',
        },
      })

      // Update invitation status
      await tx.invitation.update({
        where: { id: invitationId },
        data: { status: 'accepted' },
      })
    })

    return c.json({ message: 'Invitation accepted successfully' })
  } catch (error: any) {
    logger.error('Error accepting invitation:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * DELETE /organizations/:slug/invitations/:invitationId
 * Cancel or reject an invitation
 */
organizationsRouter.delete('/:slug/invitations/:invitationId', async (c) => {
  try {
    const user = c.get('user')
    const slug = c.req.param('slug')
    const invitationId = c.req.param('invitationId')

    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        organization: true,
      },
    })

    if (!invitation) {
      return c.json({ error: 'Invitation not found' }, 404)
    }

    if (invitation.organization.slug !== slug) {
      return c.json({ error: 'Invalid invitation' }, 400)
    }

    // Check if user can cancel this invitation (inviter or admin)
    const canCancel = invitation.inviterId === user.id ||
      await prisma.member.findFirst({
        where: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: 'admin',
        },
      })

    if (!canCancel) {
      return c.json({ error: 'Access denied' }, 403)
    }

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'cancelled' },
    })

    return c.json({ message: 'Invitation cancelled' })
  } catch (error: any) {
    logger.error('Error cancelling invitation:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * PUT /organizations/:slug/members/:memberId
 * Update member role
 */
organizationsRouter.put('/:slug/members/:memberId', async (c) => {
  try {
    const user = c.get('user')
    const slug = c.req.param('slug')
    const memberId = c.req.param('memberId')
    const body = await c.req.json()
    const { role } = updateMemberRoleSchema.parse(body)

    // Check if user is admin of the organization
    const adminMembership = await prisma.member.findFirst({
      where: {
        organization: { slug },
        userId: user.id,
        role: 'admin',
      },
    })

    if (!adminMembership) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // Find the member to update
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        organization: true,
      },
    })

    if (!member) {
      return c.json({ error: 'Member not found' }, 404)
    }

    if (member.organization.slug !== slug) {
      return c.json({ error: 'Member does not belong to this organization' }, 400)
    }

    // Prevent admin from demoting themselves if they're the only admin
    if (member.userId === user.id && role !== 'admin') {
      const adminCount = await prisma.member.count({
        where: {
          organizationId: member.organizationId,
          role: 'admin',
        },
      })

      if (adminCount <= 1) {
        return c.json({ error: 'Cannot demote the last admin' }, 400)
      }
    }

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: { role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    return c.json({ member: updatedMember })
  } catch (error: any) {
    logger.error('Error updating member role:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * DELETE /organizations/:slug/members/:memberId
 * Remove member from organization
 */
organizationsRouter.delete('/:slug/members/:memberId', async (c) => {
  try {
    const user = c.get('user')
    const slug = c.req.param('slug')
    const memberId = c.req.param('memberId')

    // Check if user is admin of the organization
    const adminMembership = await prisma.member.findFirst({
      where: {
        organization: { slug },
        userId: user.id,
        role: 'admin',
      },
    })

    if (!adminMembership) {
      return c.json({ error: 'Access denied' }, 403)
    }

    // Find the member to remove
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        organization: true,
      },
    })

    if (!member) {
      return c.json({ error: 'Member not found' }, 404)
    }

    if (member.organization.slug !== slug) {
      return c.json({ error: 'Member does not belong to this organization' }, 400)
    }

    // Prevent removing yourself if you're the only admin
    if (member.userId === user.id) {
      const adminCount = await prisma.member.count({
        where: {
          organizationId: member.organizationId,
          role: 'admin',
        },
      })

      if (adminCount <= 1) {
        return c.json({ error: 'Cannot remove the last admin' }, 400)
      }
    }

    await prisma.member.delete({
      where: { id: memberId },
    })

    return c.json({ message: 'Member removed successfully' })
  } catch (error: any) {
    logger.error('Error removing member:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default organizationsRouter
