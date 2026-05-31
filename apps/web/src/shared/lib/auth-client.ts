/**
 * Better Auth Client
 *
 * Client-side authentication for the Journey Builder frontend.
 * Includes organization plugin for multi-tenant support.
 *
 * @module lib/auth-client
 */

import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { appConfig } from "@/shared/lib/app-config";

/**
 * Better Auth client instance
 *
 * Usage:
 * ```tsx
 * const { data: session, isPending } = authClient.useSession();
 *
 * // Sign in
 * await authClient.signIn.email({ email, password });
 *
 * // Sign out
 * await authClient.signOut();
 *
 * // Organization operations
 * const { data: orgs } = authClient.useListOrganizations();
 * const { data: activeOrg } = authClient.useActiveOrganization();
 * await authClient.organization.create({ name: "My Org", slug: "my-org" });
 * await authClient.organization.setActive({ organizationId: "org-id" });
 * ```
 */
export const authClient = createAuthClient({
  baseURL: appConfig.api.url,
  plugins: [organizationClient()],
});

// Export types
export type AuthClient = typeof authClient;
export type Session = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;
