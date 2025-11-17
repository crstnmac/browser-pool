export type Plan = 'FREE' | 'PRO' | 'ENTERPRISE'

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing'

export interface User {
  id: string
  email: string
  name: string | null
  plan: Plan
  subscriptionStatus: SubscriptionStatus | null
  emailVerified: boolean
  createdAt: string
  updatedAt: string
}

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  lastUsed: string | null
  expiresAt: string | null
  createdAt: string
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

export interface Subscription {
  id: string
  plan: Plan
  status: SubscriptionStatus
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEnd: string | null
}

export interface Payment {
  id: string
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'pending'
  createdAt: string
  receiptUrl: string | null
}

export interface SubscriptionPlan {
  name: Plan
  displayName: string
  price: number
  currency: string
  interval: 'month' | 'year'
  features: {
    screenshotsPerMonth: number
    rateLimit: number
    webhooks: boolean
    scheduledScreenshots: boolean
    priority: boolean
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

export interface CreateApiKeyRequest {
  name: string
  expiresAt?: string
}

export interface AuthResponse {
  user: User
  apiKeys: ApiKey[]
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
  subscriptionStatus: SubscriptionStatus | null
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
