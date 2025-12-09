export interface ContextUser {
  id: string
  email: string
  name?: string
  emailVerified?: boolean
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  isAdmin: boolean
  dodoCustomerId?: string
}

export type HonoBindings = {
  Variables: {
    user: ContextUser
    apiKey?: {
      id: string
      userId: string
      key: string
      keyPrefix: string
    }
  }
}
