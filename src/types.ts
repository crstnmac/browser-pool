export interface ContextUser {
  id: string
  email: string
  name?: string
  emailVerified?: boolean
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED'
  isAdmin: boolean
}

export type HonoBindings = {
  Variables: {
    user: ContextUser
    session?: {
      id: string
      expiresAt?: string
    }
  }
}
