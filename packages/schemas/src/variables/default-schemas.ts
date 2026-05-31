/**
 * Default Variable Schemas
 *
 * Provides sensible default schemas for user and session variables.
 * These match the existing hardcoded variables in variable-resolver.ts
 * and can be used as a starting point for journey-specific schemas.
 *
 * @module variables/default-schemas
 */

import type { VariableSchemas } from "./variable-schema";

/**
 * Default user variable schema
 *
 * Matches the built-in user namespace variables:
 * - user.id, user.platform, user.firstName, user.lastName, user.username
 */
export const DEFAULT_USER_SCHEMA: VariableSchemas["user"] = {
  type: "object",
  description: "User context from the messaging platform",
  properties: {
    id: {
      type: "string",
      description: "Unique user identifier from the platform",
    },
    platform: {
      type: "string",
      description: "Messaging platform",
      enum: ["telegram", "whatsapp", "web", "api"],
    },
    firstName: {
      type: "string",
      description: "User's first name",
    },
    lastName: {
      type: "string",
      description: "User's last name",
    },
    username: {
      type: "string",
      description: "Platform username or handle",
    },
    vars: {
      type: "object",
      description: "User-specific persistent variables",
    },
  },
};

/**
 * Default session variable schema
 *
 * Matches the built-in session namespace variables:
 * - session.id, session.journeyId, session.status, session.currentNodeId,
 * - session.tags, session.startedAt, session.lastResponse, session.lastTimestamp
 */
export const DEFAULT_SESSION_SCHEMA: VariableSchemas["session"] = {
  type: "object",
  description: "Current journey session context",
  properties: {
    id: {
      type: "string",
      format: "uuid",
      description: "Unique session identifier",
    },
    journeyId: {
      type: "string",
      format: "uuid",
      description: "Journey being executed",
    },
    status: {
      type: "string",
      description: "Current session status",
      enum: ["active", "completed", "failed", "paused"],
    },
    currentNodeId: {
      type: "string",
      description: "Currently executing node ID",
    },
    tags: {
      type: "array",
      description: "Tags assigned to this session",
      items: { type: "string" },
    },
    startedAt: {
      type: "string",
      format: "date-time",
      description: "Session start timestamp",
    },
    lastResponse: {
      type: "string",
      description: "User's most recent message or button click",
    },
    lastTimestamp: {
      type: "string",
      format: "date-time",
      description: "Timestamp of last user response",
    },
  },
};

/**
 * Default variable schemas combining user and session
 *
 * Use this as a starting point for journey-specific schemas.
 * Journeys can override or extend these with additional properties.
 *
 * @example
 * ```typescript
 * // Use defaults
 * const journey = { variableSchemas: DEFAULT_VARIABLE_SCHEMAS };
 *
 * // Extend with custom properties
 * const customSchemas: VariableSchemas = {
 *   ...DEFAULT_VARIABLE_SCHEMAS,
 *   user: {
 *     ...DEFAULT_VARIABLE_SCHEMAS.user,
 *     properties: {
 *       ...DEFAULT_VARIABLE_SCHEMAS.user?.properties,
 *       tier: { type: "string", enum: ["free", "pro", "enterprise"] },
 *     },
 *   },
 * };
 * ```
 */
export const DEFAULT_VARIABLE_SCHEMAS: VariableSchemas = {
  user: DEFAULT_USER_SCHEMA,
  session: DEFAULT_SESSION_SCHEMA,
};
