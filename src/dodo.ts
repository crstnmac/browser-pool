import axios, { type AxiosInstance } from 'axios'
import crypto from 'crypto'
import { logger } from './logger.js'

/**
 * Dodo Payments API Client
 * https://dodo.com/docs/api
 */

export interface DodoCustomer {
  id: string
  email: string
  name: string
  metadata?: Record<string, any>
}

export interface DodoSubscription {
  id: string
  customer_id: string
  plan: string
  status: 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing'
  current_period_start: number // Unix timestamp
  current_period_end: number // Unix timestamp
  cancel_at_period_end: boolean
  trial_start?: number
  trial_end?: number
}

export interface DodoPayment {
  id: string
  customer_id: string
  subscription_id?: string
  invoice_id?: string
  amount: number // Amount in cents
  currency: string
  status: 'pending' | 'succeeded' | 'failed'
  description?: string
  receipt_url?: string
  failure_reason?: string
  paid_at?: number // Unix timestamp
}

export interface DodoCheckoutSession {
  id: string
  url: string
  customer_id: string
  subscription_id?: string
  success_url: string
  cancel_url: string
  expires_at: number
}

export interface CreateCheckoutSessionParams {
  customer_id?: string
  customer_email?: string
  plan: 'PRO' | 'ENTERPRISE'
  success_url: string
  cancel_url: string
  trial_days?: number
  metadata?: Record<string, any>
}

export interface DodoWebhookEvent {
  id: string
  type: string
  created: number
  data: {
    object: any
  }
}

class DodoPaymentsClient {
  private client: AxiosInstance
  private apiKey: string
  private webhookSecret: string

  constructor() {
    this.apiKey = process.env.DODO_API_KEY || ''
    this.webhookSecret = process.env.DODO_WEBHOOK_SECRET || ''
    const apiUrl = process.env.DODO_API_URL || 'https://api.dodo.com/v1'

    if (!this.apiKey) {
      logger.warn('DODO_API_KEY not configured - Dodo Payments features will not work')
    }

    logger.info('Dodo Payments client initialized', {
      apiUrl,
      hasApiKey: !!this.apiKey,
      hasWebhookSecret: !!this.webhookSecret,
    })

    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Dodo API Request:', {
          method: config.method,
          url: config.url,
          data: config.data,
        })
        return config
      },
      (error) => {
        // Safely extract error information to avoid circular references
        const errorInfo = {
          message: error.message,
          code: error.code,
          config: error.config ? {
            method: error.config.method,
            url: error.config.url,
          } : undefined,
        }
        logger.error('Dodo API Request Error:', errorInfo)
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Dodo API Response:', {
          status: response.status,
          data: response.data,
        })
        return response
      },
      (error) => {
        // Safely extract error information to avoid circular references
        const errorInfo = {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: error.config ? {
            method: error.config.method,
            url: error.config.url,
          } : undefined,
        }
        logger.error('Dodo API Response Error:', errorInfo)
        return Promise.reject(error)
      }
    )
  }

  /**
   * Create a customer in Dodo Payments
   */
  async createCustomer(
    email: string,
    name: string,
    metadata?: Record<string, any>
  ): Promise<DodoCustomer> {
    try {
      if (!this.apiKey) {
        throw new Error('DODO_API_KEY is not configured. Please set DODO_API_KEY environment variable.')
      }

      const response = await this.client.post('/customers', {
        email,
        name,
        metadata,
      })
      return response.data
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error'
      const errorCode = error?.code || error?.response?.status
      
      logger.error('Error creating Dodo customer:', {
        message: errorMessage,
        code: errorCode,
        apiUrl: this.client.defaults.baseURL,
        hasApiKey: !!this.apiKey,
      })

      // Provide more helpful error messages
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        const dnsError = error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN'
        const errorDetail = dnsError
          ? `DNS resolution failed for ${this.client.defaults.baseURL}. The hostname cannot be resolved.`
          : `Connection refused to ${this.client.defaults.baseURL}.`
        
        throw new Error(
          `Cannot connect to Dodo Payments API: ${errorDetail} ` +
          `Please check:\n` +
          `1. DODO_API_URL environment variable (currently: ${this.client.defaults.baseURL})\n` +
          `2. Network connectivity and DNS resolution from the container\n` +
          `3. If running in a container, ensure DNS is properly configured\n` +
          `4. If using a local/mock service, update DODO_API_URL to point to the correct host (e.g., http://host.docker.internal:PORT or service name)`
        )
      }

      if (error.response?.status === 401) {
        throw new Error(
          'Invalid Dodo Payments API key. Please check DODO_API_KEY environment variable.'
        )
      }

      throw new Error(`Failed to create customer: ${errorMessage}`)
    }
  }

  /**
   * Get a customer by ID
   */
  async getCustomer(customerId: string): Promise<DodoCustomer> {
    try {
      const response = await this.client.get(`/customers/${customerId}`)
      return response.data
    } catch (error: any) {
      logger.error('Error fetching Dodo customer:', error)
      throw new Error(`Failed to fetch customer: ${error.message}`)
    }
  }

  /**
   * Update a customer
   */
  async updateCustomer(
    customerId: string,
    data: Partial<DodoCustomer>
  ): Promise<DodoCustomer> {
    try {
      const response = await this.client.patch(`/customers/${customerId}`, data)
      return response.data
    } catch (error: any) {
      logger.error('Error updating Dodo customer:', error)
      throw new Error(`Failed to update customer: ${error.message}`)
    }
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    params: CreateCheckoutSessionParams
  ): Promise<DodoCheckoutSession> {
    try {
      const response = await this.client.post('/checkout/sessions', {
        customer_id: params.customer_id,
        customer_email: params.customer_email,
        line_items: [
          {
            price: this.getPriceIdForPlan(params.plan),
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: params.success_url,
        cancel_url: params.cancel_url,
        subscription_data: {
          trial_period_days: params.trial_days,
        },
        metadata: params.metadata,
      })
      return response.data
    } catch (error: any) {
      // Safely extract error information to avoid circular references
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error'
      const errorCode = error?.code || error?.response?.status
      
      logger.error('Error creating checkout session:', {
        message: errorMessage,
        code: errorCode,
        status: error?.response?.status,
        apiUrl: this.client.defaults.baseURL,
        hasApiKey: !!this.apiKey,
      })

      // Provide more helpful error messages
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        const dnsError = error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN'
        const errorDetail = dnsError
          ? `DNS resolution failed for ${this.client.defaults.baseURL}. The hostname cannot be resolved.`
          : `Connection refused to ${this.client.defaults.baseURL}.`
        
        throw new Error(
          `Cannot connect to Dodo Payments API: ${errorDetail} ` +
          `Please check:\n` +
          `1. DODO_API_URL environment variable (currently: ${this.client.defaults.baseURL})\n` +
          `2. Network connectivity and DNS resolution from the container\n` +
          `3. If running in a container, ensure DNS is properly configured\n` +
          `4. If using a local/mock service, update DODO_API_URL to point to the correct host (e.g., http://host.docker.internal:PORT or service name)`
        )
      }

      if (error.response?.status === 401) {
        throw new Error(
          'Invalid Dodo Payments API key. Please check DODO_API_KEY environment variable.'
        )
      }

      throw new Error(`Failed to create checkout session: ${errorMessage}`)
    }
  }

  /**
   * Get a subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<DodoSubscription> {
    try {
      const response = await this.client.get(`/subscriptions/${subscriptionId}`)
      return response.data
    } catch (error: any) {
      logger.error('Error fetching subscription:', error)
      throw new Error(`Failed to fetch subscription: ${error.message}`)
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<DodoSubscription> {
    try {
      const response = await this.client.post(
        `/subscriptions/${subscriptionId}/cancel`,
        {
          cancel_at_period_end: cancelAtPeriodEnd,
        }
      )
      return response.data
    } catch (error: any) {
      logger.error('Error canceling subscription:', error)
      throw new Error(`Failed to cancel subscription: ${error.message}`)
    }
  }

  /**
   * Reactivate a canceled subscription
   */
  async reactivateSubscription(
    subscriptionId: string
  ): Promise<DodoSubscription> {
    try {
      const response = await this.client.post(
        `/subscriptions/${subscriptionId}/reactivate`
      )
      return response.data
    } catch (error: any) {
      logger.error('Error reactivating subscription:', error)
      throw new Error(`Failed to reactivate subscription: ${error.message}`)
    }
  }

  /**
   * Update a subscription (change plan)
   */
  async updateSubscription(
    subscriptionId: string,
    newPlan: 'PRO' | 'ENTERPRISE'
  ): Promise<DodoSubscription> {
    try {
      const response = await this.client.patch(
        `/subscriptions/${subscriptionId}`,
        {
          items: [
            {
              price: this.getPriceIdForPlan(newPlan),
            },
          ],
          proration_behavior: 'create_prorations',
        }
      )
      return response.data
    } catch (error: any) {
      logger.error('Error updating subscription:', error)
      throw new Error(`Failed to update subscription: ${error.message}`)
    }
  }

  /**
   * Get a payment by ID
   */
  async getPayment(paymentId: string): Promise<DodoPayment> {
    try {
      const response = await this.client.get(`/payments/${paymentId}`)
      return response.data
    } catch (error: any) {
      logger.error('Error fetching payment:', error)
      throw new Error(`Failed to fetch payment: ${error.message}`)
    }
  }

  /**
   * List customer subscriptions
   */
  async listCustomerSubscriptions(
    customerId: string
  ): Promise<DodoSubscription[]> {
    try {
      const response = await this.client.get('/subscriptions', {
        params: { customer_id: customerId },
      })
      return response.data.data || []
    } catch (error: any) {
      logger.error('Error listing subscriptions:', error)
      throw new Error(`Failed to list subscriptions: ${error.message}`)
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    try {
      const signedPayload = `${timestamp}.${payload}`
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(signedPayload)
        .digest('hex')

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    } catch (error) {
      logger.error('Error verifying webhook signature:', error)
      return false
    }
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(body: string): DodoWebhookEvent {
    try {
      return JSON.parse(body)
    } catch (error) {
      logger.error('Error parsing webhook event:', error)
      throw new Error('Invalid webhook payload')
    }
  }

  /**
   * Get price ID for a plan
   */
  private getPriceIdForPlan(plan: 'PRO' | 'ENTERPRISE'): string {
    const priceIds = {
      PRO: process.env.DODO_PRICE_ID_PRO || 'price_pro_monthly',
      ENTERPRISE: process.env.DODO_PRICE_ID_ENTERPRISE || 'price_enterprise_monthly',
    }
    return priceIds[plan]
  }

  /**
   * Get plan prices in cents
   */
  getPlanPrice(plan: 'PRO' | 'ENTERPRISE'): number {
    const prices = {
      PRO: 2900, // $29.00
      ENTERPRISE: 29900, // $299.00
    }
    return prices[plan]
  }
}

// Export singleton instance
export const dodoPayments = new DodoPaymentsClient()
