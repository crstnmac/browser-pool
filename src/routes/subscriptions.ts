import { Hono } from "hono";
import { z } from "zod";
import type { HonoBindings } from "../types.js";
import { prisma } from "../db.js";
import { authMiddleware } from "../middleware.js";
import { dodoPayments } from "../dodo.js";
import { logger } from "../logger.js";
import { getQuotaForPlan } from "../auth.js";

const subscriptionsRouter = new Hono<HonoBindings>();

// Apply auth middleware to all routes
subscriptionsRouter.use("*", authMiddleware);

type PaidPlan = z.infer<typeof createCheckoutSchema>["plan"];

const createCheckoutSchema = z.object({
	plan: z.enum(["PRO", "ENTERPRISE"], {
		message: "Plan must be PRO or ENTERPRISE",
	}),
	trialDays: z.number().min(0).max(30).optional(),
	successUrl: z.string().url().optional(),
	cancelUrl: z.string().url().optional(),
});

const updateSubscriptionSchema = z.object({
	plan: z.enum(["PRO", "ENTERPRISE"]),
});

/**
 * GET /subscriptions
 * Get user's active subscription
 */
subscriptionsRouter.get("/", async (c) => {
	try {
		const user = c.get("user");

		const subscription = await prisma.subscription.findFirst({
			where: {
				userId: user.id,
				status: {
					in: ["ACTIVE", "TRIALING", "PAST_DUE"],
				},
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		if (!subscription) {
			return c.json({
				subscription: null,
				message: "No active subscription found",
			});
		}

		return c.json({ subscription });
	} catch (error: any) {
		logger.error("Error fetching subscription:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

/**
 * GET /subscriptions/history
 * Get user's subscription history
 */
subscriptionsRouter.get("/history", async (c) => {
	try {
		const user = c.get("user");

		const subscriptions = await prisma.subscription.findMany({
			where: {
				userId: user.id,
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		return c.json({ subscriptions });
	} catch (error: any) {
		logger.error("Error fetching subscription history:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

/**
 * POST /subscriptions/checkout
 * Create a checkout session for a new subscription
 */
subscriptionsRouter.post("/checkout", async (c) => {
	let user: any = null;
	let plan: PaidPlan | undefined = undefined;

	try {
		user = c.get("user");
		const body = await c.req.json();
		const validation = createCheckoutSchema.safeParse(body);

		if (!validation.success) {
			return c.json(
				{
					error: "Validation failed",
					details: validation.error.issues,
				},
				400,
			);
		}

		const validationData = validation.data;
		plan = validationData.plan;
		const { trialDays, successUrl, cancelUrl } = validationData;

		// Check if user already has an active subscription
		const existingSubscription = await prisma.subscription.findFirst({
			where: {
				userId: user.id,
				status: {
					in: ["ACTIVE", "TRIALING"],
				},
			},
		});

		if (existingSubscription) {
			return c.json(
				{
					error: "You already have an active subscription",
					message:
						"Please cancel your current subscription before creating a new one",
				},
				400,
			);
		}

		// Create or get Dodo customer
		let dodoCustomerId = user.dodoCustomerId;

		if (!dodoCustomerId) {
			const dodoCustomer = await dodoPayments.createCustomer(
				user.email,
				user.name || "",
				{ userId: user.id },
			);
			dodoCustomerId = dodoCustomer.id;

			// Update user with Dodo customer ID
			await prisma.user.update({
				where: { id: user.id },
				data: { dodoCustomerId },
			});
		}

		// Create checkout session
		const baseUrl = process.env.ORIGIN_URL || "http://localhost:3000";
		const session = await dodoPayments.createCheckoutSession({
			customer_id: dodoCustomerId,
			plan,
			success_url: successUrl || `${baseUrl}/subscription/success`,
			cancel_url: cancelUrl || `${baseUrl}/subscription/cancel`,
			trial_days: trialDays,
			metadata: {
				userId: user.id,
				plan,
			},
		});

		logger.info("Checkout session created", {
			userId: user.id,
			plan,
			sessionId: session.id,
		});

		return c.json({
			message: "Checkout session created",
			checkoutUrl: session.url,
			sessionId: session.id,
		});
	} catch (error: any) {
		// Safely extract error message to avoid circular references
		const errorMessage = error?.message || "Unknown error occurred";
		logger.error("Error creating checkout session:", {
			message: errorMessage,
			userId: user?.id,
			plan: plan,
		});
		return c.json(
			{
				error: "Failed to create checkout session",
				message: errorMessage,
			},
			500,
		);
	}
});

/**
 * POST /subscriptions/upgrade
 * Upgrade/downgrade current subscription
 */
subscriptionsRouter.post("/upgrade", async (c) => {
	try {
		const user = c.get("user");
		const body = await c.req.json();
		const validation = updateSubscriptionSchema.safeParse(body);

		if (!validation.success) {
			return c.json(
				{
					error: "Validation failed",
					details: validation.error.issues,
				},
				400,
			);
		}

		const { plan } = validation.data;

		// Get active subscription
		const subscription = await prisma.subscription.findFirst({
			where: {
				userId: user.id,
				status: {
					in: ["ACTIVE", "TRIALING"],
				},
			},
		});

		if (!subscription) {
			return c.json(
				{
					error: "No active subscription found",
					message: "Please create a subscription first",
				},
				404,
			);
		}

		if (subscription.plan === plan) {
			return c.json(
				{
					error: "Already on this plan",
					message: `You are already subscribed to the ${plan} plan`,
				},
				400,
			);
		}

		// Update subscription in Dodo
		const updatedDodoSub = await dodoPayments.updateSubscription(
			subscription.dodoSubscriptionId,
			plan,
		);

		// Update subscription in database
		const updatedSubscription = await prisma.subscription.update({
			where: { id: subscription.id },
			data: {
				plan,
				status: updatedDodoSub.status.toUpperCase() as any,
				currentPeriodStart: new Date(
					updatedDodoSub.current_period_start * 1000,
				),
				currentPeriodEnd: new Date(updatedDodoSub.current_period_end * 1000),
			},
		});

		// Update user plan
		await prisma.user.update({
			where: { id: user.id },
			data: { plan },
		});

		// Update quota for new plan
		const now = new Date();
		const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
		const periodEnd = new Date(
			now.getFullYear(),
			now.getMonth() + 1,
			0,
			23,
			59,
			59,
		);

		await prisma.quota.updateMany({
			where: {
				userId: user.id,
				periodStart: { lte: now },
				periodEnd: { gte: now },
			},
			data: {
				requestsLimit: getQuotaForPlan(plan),
			},
		});

		logger.info("Subscription upgraded", {
			userId: user.id,
			oldPlan: subscription.plan,
			newPlan: plan,
		});

		return c.json({
			message: "Subscription upgraded successfully",
			subscription: updatedSubscription,
		});
	} catch (error: any) {
		logger.error("Error upgrading subscription:", error);
		return c.json(
			{
				error: "Failed to upgrade subscription",
				message: error.message,
			},
			500,
		);
	}
});

/**
 * POST /subscriptions/cancel
 * Cancel current subscription
 */
subscriptionsRouter.post("/cancel", async (c) => {
	try {
		const user = c.get("user");

		// Get active subscription
		const subscription = await prisma.subscription.findFirst({
			where: {
				userId: user.id,
				status: {
					in: ["ACTIVE", "TRIALING"],
				},
			},
		});

		if (!subscription) {
			return c.json(
				{
					error: "No active subscription found",
				},
				404,
			);
		}

		// Cancel in Dodo (at period end)
		const canceledDodoSub = await dodoPayments.cancelSubscription(
			subscription.dodoSubscriptionId,
			true, // cancel at period end
		);

		// Update subscription in database
		const updatedSubscription = await prisma.subscription.update({
			where: { id: subscription.id },
			data: {
				cancelAtPeriodEnd: true,
				canceledAt: new Date(),
			},
		});

		logger.info("Subscription canceled", {
			userId: user.id,
			subscriptionId: subscription.id,
			cancelAtPeriodEnd: true,
		});

		return c.json({
			message: "Subscription will be canceled at the end of the billing period",
			subscription: updatedSubscription,
			activeUntil: subscription.currentPeriodEnd,
		});
	} catch (error: any) {
		logger.error("Error canceling subscription:", error);
		return c.json(
			{
				error: "Failed to cancel subscription",
				message: error.message,
			},
			500,
		);
	}
});

/**
 * POST /subscriptions/reactivate
 * Reactivate a canceled subscription
 */
subscriptionsRouter.post("/reactivate", async (c) => {
	try {
		const user = c.get("user");

		// Get subscription that's set to cancel
		const subscription = await prisma.subscription.findFirst({
			where: {
				userId: user.id,
				cancelAtPeriodEnd: true,
				status: {
					in: ["ACTIVE", "TRIALING"],
				},
			},
		});

		if (!subscription) {
			return c.json(
				{
					error: "No subscription scheduled for cancellation",
				},
				404,
			);
		}

		// Reactivate in Dodo
		await dodoPayments.reactivateSubscription(subscription.dodoSubscriptionId);

		// Update subscription in database
		const updatedSubscription = await prisma.subscription.update({
			where: { id: subscription.id },
			data: {
				cancelAtPeriodEnd: false,
				canceledAt: null,
			},
		});

		logger.info("Subscription reactivated", {
			userId: user.id,
			subscriptionId: subscription.id,
		});

		return c.json({
			message: "Subscription reactivated successfully",
			subscription: updatedSubscription,
		});
	} catch (error: any) {
		logger.error("Error reactivating subscription:", error);
		return c.json(
			{
				error: "Failed to reactivate subscription",
				message: error.message,
			},
			500,
		);
	}
});

/**
 * GET /subscriptions/payments
 * Get payment history
 */
subscriptionsRouter.get("/payments", async (c) => {
	try {
		const user = c.get("user");

		const payments = await prisma.payment.findMany({
			where: {
				userId: user.id,
			},
			orderBy: {
				createdAt: "desc",
			},
			take: 50, // Last 50 payments
		});

		return c.json({ payments });
	} catch (error: any) {
		logger.error("Error fetching payment history:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

/**
 * GET /subscriptions/plans
 * Get available subscription plans
 */
subscriptionsRouter.get("/plans", async (c) => {
	try {
		const plans = [
			{
				id: "FREE",
				name: "Free",
				price: 0,
				currency: "USD",
				interval: "month",
				features: [
					"100 screenshots/month",
					"5 requests/minute",
					"Standard support",
					"Basic features",
				],
				quota: 100,
				rateLimit: 5,
			},
			{
				id: "PRO",
				name: "Pro",
				price: 29,
				currency: "USD",
				interval: "month",
				features: [
					"5,000 screenshots/month",
					"30 requests/minute",
					"Priority support",
					"Webhook notifications",
					"Advanced features",
				],
				quota: 5000,
				rateLimit: 30,
			},
			{
				id: "ENTERPRISE",
				name: "Enterprise",
				price: 299,
				currency: "USD",
				interval: "month",
				features: [
					"100,000 screenshots/month",
					"100 requests/minute",
					"Dedicated support",
					"Custom features",
					"SLA guarantee",
					"Priority processing",
				],
				quota: 100000,
				rateLimit: 100,
			},
		];

		return c.json({ plans });
	} catch (error: any) {
		logger.error("Error fetching plans:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
});

export default subscriptionsRouter;
