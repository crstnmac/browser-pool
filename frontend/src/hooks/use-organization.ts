import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

export interface Organization {
  id: string
  name: string
  slug: string
  logo?: string | null
  createdAt: string
  metadata?: string | null
  members: Member[]
  invitations: Invitation[]
  _count?: {
    members: number
  }
}

export interface Member {
  id: string
  organizationId: string
  userId: string
  role: 'member' | 'admin'
  createdAt: string
  user: {
    id: string
    email: string
    name: string
  }
}

export interface Invitation {
  id: string
  email: string
  role: string | null
  createdAt: string
  expiresAt: string
}

export interface CreateOrganizationData {
  name: string
  slug: string
}

export interface InviteUserData {
  email: string
  role?: 'member' | 'admin'
}

export interface UpdateMemberRoleData {
  role: 'member' | 'admin'
}

// Custom API functions for organization management
const organizationApi = {
  // Get organizations for current user
  getOrganizations: async (): Promise<{ organizations: Organization[] }> => {
    const response = await fetch('/api/organizations', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error('Failed to fetch organizations')
    }
    return response.json()
  },

  // Get organization by slug
  getOrganization: async (slug: string): Promise<{ organization: Organization }> => {
    const response = await fetch(`/api/organizations/${slug}`, {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error('Failed to fetch organization')
    }
    return response.json()
  },

  // Create organization
  createOrganization: async (data: CreateOrganizationData): Promise<{ organization: Organization }> => {
    const response = await fetch('/api/organizations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create organization')
    }
    return response.json()
  },

  // Update organization
  updateOrganization: async (slug: string, data: CreateOrganizationData): Promise<{ organization: Organization }> => {
    const response = await fetch(`/api/organizations/${slug}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update organization')
    }
    return response.json()
  },

  // Delete organization
  deleteOrganization: async (slug: string): Promise<{ message: string }> => {
    const response = await fetch(`/api/organizations/${slug}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete organization')
    }
    return response.json()
  },

  // Invite user to organization
  inviteUser: async (slug: string, data: InviteUserData): Promise<{ invitation: Invitation }> => {
    const response = await fetch(`/api/organizations/${slug}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to invite user')
    }
    return response.json()
  },

  // Accept invitation
  acceptInvitation: async (slug: string, invitationId: string): Promise<{ message: string }> => {
    const response = await fetch(`/api/organizations/${slug}/invitations/${invitationId}/accept`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to accept invitation')
    }
    return response.json()
  },

  // Cancel invitation
  cancelInvitation: async (slug: string, invitationId: string): Promise<{ message: string }> => {
    const response = await fetch(`/api/organizations/${slug}/invitations/${invitationId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to cancel invitation')
    }
    return response.json()
  },

  // Update member role
  updateMemberRole: async (slug: string, memberId: string, data: UpdateMemberRoleData): Promise<{ member: Member }> => {
    const response = await fetch(`/api/organizations/${slug}/members/${memberId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update member role')
    }
    return response.json()
  },

  // Remove member
  removeMember: async (slug: string, memberId: string): Promise<{ message: string }> => {
    const response = await fetch(`/api/organizations/${slug}/members/${memberId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to remove member')
    }
    return response.json()
  },
}

// Query keys
export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  list: (filters?: any) => [...organizationKeys.lists(), filters] as const,
  details: () => [...organizationKeys.all, 'detail'] as const,
  detail: (slug: string) => [...organizationKeys.details(), slug] as const,
}

// Hooks
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.lists(),
    queryFn: organizationApi.getOrganizations,
  })
}

export function useOrganization(slug: string) {
  return useQuery({
    queryKey: organizationKeys.detail(slug),
    queryFn: () => organizationApi.getOrganization(slug),
    enabled: !!slug,
  })
}

export function useCreateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: organizationApi.createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() })
    },
  })
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: CreateOrganizationData }) =>
      organizationApi.updateOrganization(slug, data),
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(slug) })
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() })
    },
  })
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: organizationApi.deleteOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() })
    },
  })
}

export function useInviteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: InviteUserData }) =>
      organizationApi.inviteUser(slug, data),
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(slug) })
    },
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ slug, invitationId }: { slug: string; invitationId: string }) =>
      organizationApi.acceptInvitation(slug, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() })
    },
  })
}

export function useCancelInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ slug, invitationId }: { slug: string; invitationId: string }) =>
      organizationApi.cancelInvitation(slug, invitationId),
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(slug) })
    },
  })
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ slug, memberId, data }: { slug: string; memberId: string; data: UpdateMemberRoleData }) =>
      organizationApi.updateMemberRole(slug, memberId, data),
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(slug) })
    },
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ slug, memberId }: { slug: string; memberId: string }) =>
      organizationApi.removeMember(slug, memberId),
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(slug) })
    },
  })
}

// Active organization context - simplified for now
export function useActiveOrganization() {
  // For now, return null since we don't have active organization tracking
  // In a real implementation, you'd track the active organization in local storage or session
  return null
}

// Organization switcher hook - simplified for now
export function useOrganizationSwitcher() {
  const [isSwitching, setIsSwitching] = useState(false)
  const queryClient = useQueryClient()

  const switchOrganization = async (_organizationId: string | null) => {
    setIsSwitching(true)
    try {
      // For now, we'll just invalidate queries to refresh the UI
      // In a real implementation, you'd update the user's active organization in the session
      queryClient.invalidateQueries()
    } catch (error) {
      console.error('Failed to switch organization:', error)
      throw error
    } finally {
      setIsSwitching(false)
    }
  }

  return {
    switchOrganization,
    isSwitching,
  }
}
