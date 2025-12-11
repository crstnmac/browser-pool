import axios from 'axios'
import type {
  Screenshot,
  Webhook,
  UsageStats,
  CreateScreenshotRequest,
  BulkScreenshotRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  ScheduledScreenshot,
  CreateScheduledScreenshotRequest,
  AdminUser,
  AdminAnalytics,
} from '@/types/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// User API
export const userApi = {
  getUsage: async () => {
    const response = await apiClient.get<UsageStats>('/users/usage')
    return response.data
  },
}

// Screenshots API
export const screenshotsApi = {
  create: async (data: CreateScreenshotRequest) => {
    const response = await apiClient.post<Screenshot>('/screenshot', data)
    return response.data
  },

  createBulk: async (data: BulkScreenshotRequest) => {
    const response = await apiClient.post<{ screenshots: Screenshot[] }>('/screenshot/bulk', data)
    return response.data
  },

  list: async (page = 1, limit = 20) => {
    const response = await apiClient.get<{ screenshots: Screenshot[]; total: number; page: number; pages: number }>(
      '/screenshots',
      { params: { page, limit } }
    )
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<Screenshot>(`/screenshots/${id}`)
    return response.data
  },

  getMetadata: async (id: string) => {
    const response = await apiClient.get<Screenshot['metadata']>(`/screenshots/${id}/metadata`)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete<{ message: string }>(`/screenshots/${id}`)
    return response.data
  },

  deleteAll: async () => {
    const response = await apiClient.delete<{ message: string }>('/screenshots')
    return response.data
  },
}

// Webhooks API
export const webhooksApi = {
  list: async () => {
    const response = await apiClient.get<Webhook[]>('/webhooks')
    return response.data
  },

  create: async (data: CreateWebhookRequest) => {
    const response = await apiClient.post<Webhook>('/webhooks', data)
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<Webhook>(`/webhooks/${id}`)
    return response.data
  },

  update: async (id: string, data: UpdateWebhookRequest) => {
    const response = await apiClient.patch<Webhook>(`/webhooks/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete<{ message: string }>(`/webhooks/${id}`)
    return response.data
  },

  test: async (id: string) => {
    const response = await apiClient.post<{ message: string }>(`/webhooks/${id}/test`)
    return response.data
  },
}

// Scheduled Screenshots API
export const scheduledScreenshotsApi = {
  list: async () => {
    const response = await apiClient.get<ScheduledScreenshot[]>('/scheduled')
    return response.data
  },

  create: async (data: CreateScheduledScreenshotRequest) => {
    const response = await apiClient.post<ScheduledScreenshot>('/scheduled', data)
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<ScheduledScreenshot>(`/scheduled/${id}`)
    return response.data
  },

  update: async (id: string, data: Partial<CreateScheduledScreenshotRequest> & { active?: boolean }) => {
    const response = await apiClient.patch<ScheduledScreenshot>(`/scheduled/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete<{ message: string }>(`/scheduled/${id}`)
    return response.data
  },
}

// Admin API
export const adminApi = {
  listUsers: async (page = 1, limit = 20) => {
    const response = await apiClient.get<{ users: AdminUser[]; total: number; page: number; pages: number }>(
      '/admin/users',
      { params: { page, limit } }
    )
    return response.data
  },

  getUser: async (id: string) => {
    const response = await apiClient.get<AdminUser>(`/admin/users/${id}`)
    return response.data
  },

  getAnalytics: async () => {
    const response = await apiClient.get<AdminAnalytics>('/admin/analytics')
    return response.data
  },

  getHealth: async () => {
    const response = await apiClient.get<Record<string, unknown>>('/admin/health')
    return response.data
  },
}

export default apiClient
