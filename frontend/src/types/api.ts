export type Plan = 'FREE' | 'PRO' | 'ENTERPRISE'

export interface User {
  id: string
  email: string
  name: string | null
  plan: Plan
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface Screenshot {
  id: string
  url: string
  fullUrl: string
  format: 'png' | 'jpeg'
  width: number
  height: number
  fileSize: number
  cookiesHandled: boolean
  popupsBlocked: boolean
  createdAt: string
  expiresAt: string
  metadata?: Record<string, any>
}

export interface Webhook {
  id: string
  url: string
  events: string[]
  active: boolean
  createdAt: string
  lastTriggeredAt: string | null
}

export interface UsageStats {
  currentPeriod: {
    screenshotsUsed: number
    screenshotsLimit: number
    resetDate: string
  }
  total: {
    totalScreenshots: number
    totalApiCalls: number
  }
}

export interface CreateScreenshotRequest {
  url: string
  format?: 'png' | 'jpeg'
  fullPage?: boolean
  width?: number
  height?: number
  deviceType?: 'desktop' | 'mobile' | 'tablet'
  handleCookies?: boolean
  blockPopups?: boolean
}

export interface BulkScreenshotRequest {
  urls: string[]
  format?: 'png' | 'jpeg'
  fullPage?: boolean
  width?: number
  height?: number
  deviceType?: 'desktop' | 'mobile' | 'tablet'
  handleCookies?: boolean
  blockPopups?: boolean
}

export interface CreateWebhookRequest {
  url: string
  events: string[]
}

export interface UpdateWebhookRequest {
  url?: string
  events?: string[]
  active?: boolean
}

export interface AuthResponse {
  user: User
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface UpdateProfileRequest {
  name?: string
  email?: string
}

export interface ScheduledScreenshot {
  id: string
  url: string
  schedule: string // cron expression
  format: 'png' | 'jpeg'
  fullPage: boolean
  width: number
  height: number
  deviceType: 'desktop' | 'mobile' | 'tablet'
  handleCookies: boolean
  blockPopups: boolean
  active: boolean
  lastRun: string | null
  nextRun: string | null
  createdAt: string
}

export interface CreateScheduledScreenshotRequest {
  url: string
  schedule: string // cron expression
  format?: 'png' | 'jpeg'
  fullPage?: boolean
  width?: number
  height?: number
  deviceType?: 'desktop' | 'mobile' | 'tablet'
  handleCookies?: boolean
  blockPopups?: boolean
}

export interface AdminUser {
  id: string
  email: string
  name: string | null
  plan: Plan
  emailVerified: boolean
  createdAt: string
  updatedAt: string
  _count: {
    apiKeys: number
    screenshots: number
    webhooks: number
  }
}

export interface AdminAnalytics {
  users: {
    total: number
    active: number
    byPlan: Record<Plan, number>
  }
  screenshots: {
    total: number
    today: number
    thisMonth: number
  }
  requests: {
    total: number
    today: number
    errorRate: number
  }
}

export interface ApiError {
  error: string
  message: string
  details?: any
}
