import axios, { AxiosError } from 'axios'
import type {
  User,
  ApiKey,
  Screenshot,
  Webhook,
  UsageStats,
  Subscription,
  Payment,
  SubscriptionPlan,
  CreateScreenshotRequest,
  BulkScreenshotRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  CreateApiKeyRequest,
  RegisterRequest,
  LoginRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  ScheduledScreenshot,
  CreateScheduledScreenshotRequest,
  AdminUser,
  AdminAnalytics,
  ApiError,
} from '@/types/api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const apiKey = localStorage.getItem('apiKey')
    if (apiKey) {
      config.headers['X-API-Key'] = apiKey
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('apiKey')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  register: async (data: RegisterRequest) => {
    const response = await apiClient.post<{ message: string }>('/auth/register', data)
    return response.data
  },

  login: async (data: LoginRequest) => {
    const response = await apiClient.post<{ apiKey: string; user: User }>('/auth/login', data)
    if (response.data.apiKey) {
      localStorage.setItem('apiKey', response.data.apiKey)
    }
    return response.data
  },

  logout: () => {
    localStorage.removeItem('apiKey')
  },

  requestPasswordReset: async (email: string) => {
    const response = await apiClient.post<{ message: string }>('/account/request-password-reset', { email })
    return response.data
  },

  resetPassword: async (token: string, password: string) => {
    const response = await apiClient.post<{ message: string }>('/account/reset-password', { token, password })
    return response.data
  },

  verifyEmail: async (token: string) => {
    const response = await apiClient.post<{ message: string }>('/account/verify-email', { token })
    return response.data
  },

  requestEmailVerification: async () => {
    const response = await apiClient.post<{ message: string }>('/account/request-email-verification')
    return response.data
  },
}

// User API
export const userApi = {
  getProfile: async () => {
    const response = await apiClient.get<User>('/users/me')
    return response.data
  },

  getUsage: async () => {
    const response = await apiClient.get<UsageStats>('/users/usage')
    return response.data
  },

  updateProfile: async (data: UpdateProfileRequest) => {
    const response = await apiClient.patch<User>('/account/profile', data)
    return response.data
  },

  changePassword: async (data: ChangePasswordRequest) => {
    const response = await apiClient.post<{ message: string }>('/account/change-password', data)
    return response.data
  },

  exportData: async () => {
    const response = await apiClient.get<any>('/account/export')
    return response.data
  },

  deleteAccount: async (password: string) => {
    const response = await apiClient.delete<{ message: string }>('/account', { data: { password } })
    return response.data
  },
}

// API Keys API
export const apiKeysApi = {
  list: async () => {
    const response = await apiClient.get<ApiKey[]>('/users/api-keys')
    return response.data
  },

  create: async (data: CreateApiKeyRequest) => {
    const response = await apiClient.post<{ apiKey: string; key: ApiKey }>('/users/api-keys', data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete<{ message: string }>(`/users/api-keys/${id}`)
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

// Subscriptions API
export const subscriptionsApi = {
  getCurrent: async () => {
    const response = await apiClient.get<Subscription>('/subscriptions')
    return response.data
  },

  getHistory: async () => {
    const response = await apiClient.get<Subscription[]>('/subscriptions/history')
    return response.data
  },

  getPlans: async () => {
    const response = await apiClient.get<SubscriptionPlan[]>('/subscriptions/plans')
    return response.data
  },

  createCheckout: async (planId: string) => {
    const response = await apiClient.post<{ checkoutUrl: string }>('/subscriptions/checkout', { planId })
    return response.data
  },

  upgrade: async (planId: string) => {
    const response = await apiClient.post<Subscription>('/subscriptions/upgrade', { planId })
    return response.data
  },

  cancel: async () => {
    const response = await apiClient.post<{ message: string }>('/subscriptions/cancel')
    return response.data
  },

  reactivate: async () => {
    const response = await apiClient.post<Subscription>('/subscriptions/reactivate')
    return response.data
  },

  getPayments: async () => {
    const response = await apiClient.get<Payment[]>('/subscriptions/payments')
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

  updateUser: async (id: string, data: { plan?: string; subscriptionStatus?: string }) => {
    const response = await apiClient.patch<AdminUser>(`/admin/users/${id}`, data)
    return response.data
  },

  getAnalytics: async () => {
    const response = await apiClient.get<AdminAnalytics>('/admin/analytics')
    return response.data
  },

  getHealth: async () => {
    const response = await apiClient.get<any>('/admin/health')
    return response.data
  },
}

export default apiClient
