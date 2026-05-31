/**
 * Better Auth Configuration
 *
 * Handles authentication for the Journey Builder platform.
 * Uses Drizzle ORM adapter for PostgreSQL storage.
 * Includes organization plugin for multi-tenant support.
 *
 * @module lib/auth
 */

import { db } from "@journey/db";
import * as schema from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import { initializeOrganization } from "../services/organization-init-service";
import { appConfig } from "../config";
import { ac, roles } from "./permissions";

const log = createLogger("auth");

// Get environment variables
const authSecret = appConfig.auth.secret;
const frontendUrl = appConfig.frontend.url;
const isTestEnv = appConfig.env.isTest;

// Security: Fail-fast without proper secret (except in test environment)
if (!authSecret && !isTestEnv) {
  throw new Error(
    "BETTER_AUTH_SECRET environment variable is required. " +
    "Set it in your .env file or environment variables."
  );
}

/**
 * Better Auth instance configured for the Journey platform
 */
export const auth = betterAuth({
  baseURL: appConfig.urls.apiBaseUrl || `http://localhost:${appConfig.server.port}`,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      // Core auth tables
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      // Organization plugin tables
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),

  // Email/password authentication enabled
  emailAndPassword: {
    enabled: true,
    // Disable email verification for MVP
    requireEmailVerification: false,
  },

  // Session configuration
  session: {
    // 7 days session duration
    expiresIn: 60 * 60 * 24 * 7,
    // Refresh session if it expires in less than 1 day
    updateAge: 60 * 60 * 24,
    // Use cookies for session storage
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Security settings - secret is required (enforced at startup, test env gets fallback)
  secret: authSecret || "test-secret-for-vitest",

  // Trusted origins for CORS
  trustedOrigins: [frontendUrl, "http://localhost:3000", "http://localhost:4173", "http://localhost:5173"],

  // Advanced options
  advanced: {
    // Use secure cookies when not in test environment
    useSecureCookies: appConfig.auth.useSecureCookies,
  },

  // Logging
  logger: {
    disabled: false,
    level: "info",
  },

  // Plugins
  plugins: [
    organization({
      // Access control configuration for RBAC
      ac,
      roles,
      // Allow any authenticated user to create an organization
      allowUserToCreateOrganization: true,
      // Creator becomes owner of the organization
      creatorRole: "owner",
      // Organization lifecycle hooks
      organizationHooks: {
        // Initialize new organizations with default resources
        afterCreateOrganization: async ({ organization: org, member, user }) => {
          log.info(
            { organizationId: org.id, userId: user.id, memberId: member.id },
            "auth:organizationHooks:afterCreate"
          );
          try {
            // Initialize organization with default pipeline and demo journey
            await initializeOrganization(org.id, user.id);
          } catch (error) {
            // Log error but don't block organization creation
            log.error(
              { organizationId: org.id, userId: user.id, err: serializeError(error) },
              "auth:organizationHooks:afterCreate:error"
            );
          }
        },
      },
    }),
  ],
});

// Export the auth type for use in middleware
export type Auth = typeof auth;

log.info({ frontendUrl }, "auth:initialized");
