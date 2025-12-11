import bcrypt from "bcrypt";
import crypto from "crypto";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";

const SALT_ROUNDS = 10;

/**
 * Better Auth instance configured for Prisma + email/password.
 * This powers the built-in /api/auth/* handler and session validation.
 */
export const auth = betterAuth({
	baseURL:
		process.env.AUTH_BASE_URL ||
		process.env.ORIGIN_URL?.split(",")[0] ||
		"http://localhost:3000",
	appName: "Browser Pool",
	database: prismaAdapter(prisma, { provider: "postgresql" }),
	emailAndPassword: {
		enabled: true,
	},
	plugins: [organization()],
});

/**
 * Expose the Better Auth handler for Hono mounting.
 */
export function authHandler(req: Request) {
	return auth.handler(req);
}

/**
 * Hash a password using bcrypt (kept for legacy flows like password reset).
 */
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash (kept for legacy flows like password reset).
 */
export async function verifyPassword(
	password: string,
	hash: string,
): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

/**
 * Legacy API key helpers (kept for scripts and data export).
 */
export function generateApiKey(): string {
	const env = process.env.NODE_ENV === "production" ? "live" : "test";
	const prefix = process.env.API_KEY_PREFIX || "bp_";
	const randomBytes = crypto.randomBytes(24).toString("hex");
	return `${prefix}${env}_${randomBytes}`;
}

export function extractKeyPrefix(apiKey: string): string {
	return apiKey.substring(0, 12);
}

export async function hashApiKey(apiKey: string): Promise<string> {
	return bcrypt.hash(apiKey, SALT_ROUNDS);
}

export async function verifyApiKey(
	apiKey: string,
	hash: string,
): Promise<boolean> {
	return bcrypt.compare(apiKey, hash);
}

/**
 * Get rate limit for a user based on their plan
 */
export function getRateLimitForPlan(plan: string): number {
	switch (plan) {
		case "FREE":
			return parseInt(process.env.RATE_LIMIT_FREE || "5");
		case "PRO":
			return parseInt(process.env.RATE_LIMIT_PRO || "30");
		case "ENTERPRISE":
			return parseInt(process.env.RATE_LIMIT_ENTERPRISE || "100");
		default:
			return 5;
	}
}

/**
 * Get monthly quota for a user based on their plan
 */
export function getQuotaForPlan(plan: string): number {
	switch (plan) {
		case "FREE":
			return parseInt(process.env.QUOTA_FREE || "100");
		case "PRO":
			return parseInt(process.env.QUOTA_PRO || "5000");
		case "ENTERPRISE":
			return parseInt(process.env.QUOTA_ENTERPRISE || "100000");
		default:
			return 100;
	}
}

/**
 * Get or create quota for current month
 */
export async function getCurrentQuota(userId: string) {
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

	let quota = await prisma.quota.findFirst({
		where: {
			userId,
			periodStart: {
				lte: now,
			},
			periodEnd: {
				gte: now,
			},
		},
	});

	if (!quota) {
		const user = await prisma.user.findUnique({ where: { id: userId } });
		if (!user) {
			throw new Error("User not found");
		}

		quota = await prisma.quota.create({
			data: {
				userId,
				periodStart,
				periodEnd,
				requestsMade: 0,
				requestsLimit: getQuotaForPlan(user.plan),
			},
		});
	}

	return quota;
}

/**
 * Check if user has quota remaining
 */
export async function hasQuotaRemaining(userId: string): Promise<boolean> {
	const quota = await getCurrentQuota(userId);
	return quota.requestsMade < quota.requestsLimit;
}

/**
 * Increment usage quota
 */
export async function incrementQuota(userId: string): Promise<void> {
	const quota = await getCurrentQuota(userId);
	await prisma.quota.update({
		where: { id: quota.id },
		data: {
			requestsMade: {
				increment: 1,
			},
		},
	});
}
