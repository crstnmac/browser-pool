import { Hono } from 'hono'
import type { HonoBindings } from '../types.js'
import { prisma } from '../db.js'
import { dodoPayments, type DodoWebhookEvent } from '../dodo.js'
import { logger } from '../logger.js'
import { getQuotaForPlan } from '../auth.js'
import { triggerWebhooks } from '../webhooks.js'

const dodoWebhooksRouter = new Hono<HonoBindings>()

/**
 * POST /dodo-webhooks
 * Handle Dodo Payments webhook events
 */
dodoWebhooksRouter.post('/', async (c) => {
  try {
    const signature = c.req.header('X-Dodo-Signature')
    const timestamp = c.req.header('X-Dodo-Timestamp')
    const body = await c.req.text()

    if (!signature || !timestamp) {
      logger.warn('Missing webhook signature or timestamp')
      return c.json({ error: 'Missing signature' }, 400)
    }

    // Verify webhook signature
    const isValid = dodoPayments.verifyWebhookSignature(
      body,
      signature,
      timestamp
    )

    if (!isValid) {
      logger.warn('Invalid webhook signature')
      return c.json({ error: 'Invalid signature' }, 401)
    }

    // Parse event
    const event: DodoWebhookEvent = dodoPayments.parseWebhookEvent(body)

    logger.info('Received Dodo webhook', {
      eventId: event.id,
      eventType: event.type,
    })

    // Handle event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event)
        break

      case 'subscription.created':
        await handleSubscriptionCreated(event)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(event)
        break

      case 'subscription.deleted':
        await handleSubscriptionDeleted(event)
        break

      case 'payment.succeeded':
        await handlePaymentSucceeded(event)
        break

      case 'payment.failed':
        await handlePaymentFailed(event)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event)
        break

      default:
        logger.info('Unhandled webhook event type:', event.type)
    }

    return c.json({ received: true })
  } catch (error: any) {
    logger.error('Error processing webhook:', error)
    return c.json({ error: 'Webhook processing failed' }, 500)
  }
})

/**
 * Handle checkout.session.completed event
 */
async function handleCheckoutCompleted(event: DodoWebhookEvent) {
  const session = event.data.object

  logger.info('Processing checkout completed', {
    sessionId: session.id,
    customerId: session.customer_id,
  })

  // The subscription will be created in subscription.created event
  // This is just for logging/tracking
}

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(event: DodoWebhookEvent) {
  const dodoSub = event.data.object

  try {
    // Find user by Dodo customer ID
    const user = await prisma.user.findUnique({
      where: { dodoCustomerId: dodoSub.customer_id },
    })

    if (!user) {
      logger.error('User not found for subscription', {
        customerId: dodoSub.customer_id,
      })
      return
    }

    // Determine plan from subscription
    const plan = determinePlanFromSubscription(dodoSub)

    // Create subscription in database
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        dodoSubscriptionId: dodoSub.id,
        dodoCustomerId: dodoSub.customer_id,
        plan,
        status: mapDodoStatus(dodoSub.status),
        currentPeriodStart: new Date(dodoSub.current_period_start * 1000),
        currentPeriodEnd: new Date(dodoSub.current_period_end * 1000),
        trialStart: dodoSub.trial_start
          ? new Date(dodoSub.trial_start * 1000)
          : null,
        trialEnd: dodoSub.trial_end
          ? new Date(dodoSub.trial_end * 1000)
          : null,
      },
    })

    // Update user plan
    await prisma.user.update({
      where: { id: user.id },
      data: { plan },
    })

    // Create or update quota
    await updateUserQuota(user.id, plan)

    logger.info('Subscription created', {
      userId: user.id,
      subscriptionId: subscription.id,
      plan,
    })

    // Trigger webhook
    await triggerWebhooks(user.id, 'subscription.created' as any, {
      plan,
      subscriptionId: subscription.id,
    })
  } catch (error) {
    logger.error('Error handling subscription created:', error)
    throw error
  }
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(event: DodoWebhookEvent) {
  const dodoSub = event.data.object

  try {
    // Find subscription
    const subscription = await prisma.subscription.findUnique({
      where: { dodoSubscriptionId: dodoSub.id },
    })

    if (!subscription) {
      logger.error('Subscription not found', { dodoSubId: dodoSub.id })
      return
    }

    const plan = determinePlanFromSubscription(dodoSub)
    const status = mapDodoStatus(dodoSub.status)

    // Update subscription
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan,
        status,
        currentPeriodStart: new Date(dodoSub.current_period_start * 1000),
        currentPeriodEnd: new Date(dodoSub.current_period_end * 1000),
        cancelAtPeriodEnd: dodoSub.cancel_at_period_end,
      },
    })

    // Update user plan if changed
    if (subscription.plan !== plan) {
      await prisma.user.update({
        where: { id: subscription.userId },
        data: { plan },
      })

      await updateUserQuota(subscription.userId, plan)

      logger.info('Subscription plan updated', {
        userId: subscription.userId,
        oldPlan: subscription.plan,
        newPlan: plan,
      })
    }

    // Trigger webhook
    await triggerWebhooks(subscription.userId, 'subscription.updated' as any, {
      plan,
      status,
      subscriptionId: subscription.id,
    })
  } catch (error) {
    logger.error('Error handling subscription updated:', error)
    throw error
  }
}

/**
 * Handle subscription.deleted event
 */
async function handleSubscriptionDeleted(event: DodoWebhookEvent) {
  const dodoSub = event.data.object

  try {
    // Find subscription
    const subscription = await prisma.subscription.findUnique({
      where: { dodoSubscriptionId: dodoSub.id },
    })

    if (!subscription) {
      logger.error('Subscription not found', { dodoSubId: dodoSub.id })
      return
    }

    // Update subscription status
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
    })

    // Downgrade user to FREE plan
    await prisma.user.update({
      where: { id: subscription.userId },
      data: { plan: 'FREE' },
    })

    // Update quota to FREE tier
    await updateUserQuota(subscription.userId, 'FREE')

    logger.info('Subscription canceled', {
      userId: subscription.userId,
      subscriptionId: subscription.id,
    })

    // Trigger webhook
    await triggerWebhooks(subscription.userId, 'subscription.canceled' as any, {
      subscriptionId: subscription.id,
      canceledAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Error handling subscription deleted:', error)
    throw error
  }
}

/**
 * Handle payment.succeeded event
 */
async function handlePaymentSucceeded(event: DodoWebhookEvent) {
  const dodoPayment = event.data.object

  try {
    // Find user by customer ID
    const user = await prisma.user.findUnique({
      where: { dodoCustomerId: dodoPayment.customer_id },
    })

    if (!user) {
      logger.error('User not found for payment', {
        customerId: dodoPayment.customer_id,
      })
      return
    }

    // Find subscription if exists
    const subscription = await prisma.subscription.findFirst({
      where: {
        dodoSubscriptionId: dodoPayment.subscription_id,
      },
    })

    // Create payment record
    await prisma.payment.create({
      data: {
        userId: user.id,
        subscriptionId: subscription?.id,
        dodoPaymentId: dodoPayment.id,
        dodoInvoiceId: dodoPayment.invoice_id,
        amount: dodoPayment.amount,
        currency: dodoPayment.currency,
        status: 'SUCCEEDED',
        plan: subscription?.plan || 'FREE',
        description: dodoPayment.description,
        receiptUrl: dodoPayment.receipt_url,
        paidAt: dodoPayment.paid_at
          ? new Date(dodoPayment.paid_at * 1000)
          : new Date(),
      },
    })

    logger.info('Payment succeeded', {
      userId: user.id,
      paymentId: dodoPayment.id,
      amount: dodoPayment.amount,
    })

    // Trigger webhook
    await triggerWebhooks(user.id, 'payment.succeeded' as any, {
      paymentId: dodoPayment.id,
      amount: dodoPayment.amount,
      currency: dodoPayment.currency,
    })
  } catch (error) {
    logger.error('Error handling payment succeeded:', error)
    throw error
  }
}

/**
 * Handle payment.failed event
 */
async function handlePaymentFailed(event: DodoWebhookEvent) {
  const dodoPayment = event.data.object

  try {
    // Find user by customer ID
    const user = await prisma.user.findUnique({
      where: { dodoCustomerId: dodoPayment.customer_id },
    })

    if (!user) {
      logger.error('User not found for failed payment', {
        customerId: dodoPayment.customer_id,
      })
      return
    }

    // Find subscription if exists
    const subscription = await prisma.subscription.findFirst({
      where: {
        dodoSubscriptionId: dodoPayment.subscription_id,
      },
    })

    // Create payment record
    await prisma.payment.create({
      data: {
        userId: user.id,
        subscriptionId: subscription?.id,
        dodoPaymentId: dodoPayment.id,
        dodoInvoiceId: dodoPayment.invoice_id,
        amount: dodoPayment.amount,
        currency: dodoPayment.currency,
        status: 'FAILED',
        plan: subscription?.plan || 'FREE',
        description: dodoPayment.description,
        failureReason: dodoPayment.failure_reason,
      },
    })

    logger.warn('Payment failed', {
      userId: user.id,
      paymentId: dodoPayment.id,
      reason: dodoPayment.failure_reason,
    })

    // Trigger webhook
    await triggerWebhooks(user.id, 'payment.failed' as any, {
      paymentId: dodoPayment.id,
      amount: dodoPayment.amount,
      reason: dodoPayment.failure_reason,
    })
  } catch (error) {
    logger.error('Error handling payment failed:', error)
    throw error
  }
}

/**
 * Handle invoice.paid event
 */
async function handleInvoicePaid(event: DodoWebhookEvent) {
  // Similar to payment.succeeded, just log it
  logger.info('Invoice paid', { invoiceId: event.data.object.id })
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(event: DodoWebhookEvent) {
  const invoice = event.data.object

  try {
    // Find subscription
    const subscription = await prisma.subscription.findFirst({
      where: { dodoSubscriptionId: invoice.subscription_id },
    })

    if (!subscription) {
      return
    }

    // Update subscription status to PAST_DUE
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE' },
    })

    logger.warn('Invoice payment failed, subscription past due', {
      userId: subscription.userId,
      subscriptionId: subscription.id,
    })

    // Trigger webhook
    await triggerWebhooks(subscription.userId, 'subscription.past_due' as any, {
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
    })
  } catch (error) {
    logger.error('Error handling invoice payment failed:', error)
    throw error
  }
}

/**
 * Helper: Determine plan from Dodo subscription
 * Validates against actual price IDs from environment variables
 * @throws Error if plan cannot be determined
 */
function determinePlanFromSubscription(dodoSub: any): 'PRO' | 'ENTERPRISE' {
  const proPriceId = process.env.DODO_PRICE_ID_PRO
  const enterprisePriceId = process.env.DODO_PRICE_ID_ENTERPRISE

  if (!proPriceId || !enterprisePriceId) {
    logger.error('Dodo price IDs not configured in environment variables')
    throw new Error('Price IDs not configured - cannot determine subscription plan')
  }

  // Check if subscription has items with price information
  if (dodoSub.items && Array.isArray(dodoSub.items) && dodoSub.items.length > 0) {
    const priceId = dodoSub.items[0].price?.id || dodoSub.items[0].price

    if (!priceId) {
      logger.error('No price ID found in subscription items', {
        subscriptionId: dodoSub.id,
        items: dodoSub.items,
      })
      throw new Error('No price ID found in subscription - cannot determine plan')
    }

    // Match against configured price IDs
    if (priceId === enterprisePriceId) {
      return 'ENTERPRISE'
    } else if (priceId === proPriceId) {
      return 'PRO'
    } else {
      logger.error('Unknown price ID in subscription', {
        subscriptionId: dodoSub.id,
        priceId,
        expectedPro: proPriceId,
        expectedEnterprise: enterprisePriceId,
      })
      throw new Error(
        `Unknown price ID "${priceId}" - does not match PRO or ENTERPRISE plans`
      )
    }
  }

  // Fallback: check metadata if price not in items
  if (dodoSub.metadata?.plan) {
    const metadataPlan = dodoSub.metadata.plan.toUpperCase()
    if (metadataPlan === 'ENTERPRISE') {
      logger.warn('Using metadata plan (no price ID found)', {
        subscriptionId: dodoSub.id,
        plan: 'ENTERPRISE',
      })
      return 'ENTERPRISE'
    } else if (metadataPlan === 'PRO') {
      logger.warn('Using metadata plan (no price ID found)', {
        subscriptionId: dodoSub.id,
        plan: 'PRO',
      })
      return 'PRO'
    }
  }

  // No valid plan information found
  logger.error('Cannot determine plan from subscription - no valid price ID or metadata', {
    subscriptionId: dodoSub.id,
    hasItems: !!dodoSub.items,
    hasMetadata: !!dodoSub.metadata,
    subscriptionData: JSON.stringify(dodoSub),
  })

  throw new Error(
    'Cannot determine subscription plan - invalid or missing price information. ' +
    'Please check Dodo webhook configuration and price IDs.'
  )
}

/**
 * Helper: Map Dodo status to our status
 */
function mapDodoStatus(
  dodoStatus: string
): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'TRIALING' | 'UNPAID' {
  const statusMap: Record<string, any> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    trialing: 'TRIALING',
    unpaid: 'UNPAID',
  }
  return statusMap[dodoStatus] || 'ACTIVE'
}

/**
 * Helper: Update user quota based on plan
 */
async function updateUserQuota(userId: string, plan: string) {
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  )

  const quota = await prisma.quota.findFirst({
    where: {
      userId,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
  })

  const newLimit = getQuotaForPlan(plan)

  if (quota) {
    await prisma.quota.update({
      where: { id: quota.id },
      data: { requestsLimit: newLimit },
    })
  } else {
    await prisma.quota.create({
      data: {
        userId,
        periodStart,
        periodEnd,
        requestsMade: 0,
        requestsLimit: newLimit,
      },
    })
  }
}

export default dodoWebhooksRouter
