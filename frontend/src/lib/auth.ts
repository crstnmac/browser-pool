import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import type { Session } from "better-auth";

export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
	plugins: [organizationClient()],
});

export const {
	signIn,
	signUp,
	signOut,
	useSession: _useSession,
	updateUser,
	changePassword,
} = authClient;

// Extend the User type from better-auth with custom fields
export interface ExtendedUser {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	email: string;
	emailVerified: boolean;
	name: string;
	image?: string | null;
	plan?: "FREE" | "PRO" | "ENTERPRISE";
}

export interface ExtendedSession extends Session {
	user: ExtendedUser;
}

// Export useSession with proper typing
export const useSession = () => {
	const session = _useSession() as {
		data: ExtendedSession | null;
		isPending: boolean;
	};
	return session;
};
