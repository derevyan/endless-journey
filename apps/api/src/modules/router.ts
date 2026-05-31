/**
 * Central API Router
 *
 * Composes all module routes into a single router.
 * This provides a single entry point for route registration in app.ts,
 * making the codebase easier to navigate and reducing merge conflicts.
 *
 * @module modules/router
 */

import { Hono } from "hono";
import type { Variables } from "../lib/auth-helpers";

// =============================================================================
// ROUTE IMPORTS
// =============================================================================

// Core domain routes
import { journeys, journeyVersions } from "./journeys";
import { sessionsRoutes } from "./sessions";
import { channels } from "./channels";
import { aiReportRoutes } from "./ai-report";

// User and client routes
import { usersRoutes } from "./users";
import { tags, tagDefinitions } from "./tags";

// Configuration routes
import { variables } from "./variables";

// Event API routes
import { events } from "./event-api";

// Media routes
import { uploads } from "./uploads";

// CRM domain routes
import { crm } from "./crm";
import { mindstates } from "./mindstates";

// Simulator routes
import { simulator } from "./simulator";

// Workflow routes
import { workflows, workflowVersions, workflowApprovalsRouter } from "./workflows";

// LLM routes (models, tools, audio)
import { llm } from "./llm";

// Prompt repository routes
import { prompts } from "./prompts";

// Webhook routes
import { telegramWebhook } from "./channels";

// =============================================================================
// ROUTER COMPOSITION
// =============================================================================

/**
 * Create the composed API router.
 *
 * This function mounts all module routes onto a single router,
 * which can then be mounted at /api in app.ts.
 *
 * Route structure:
 * - /journeys - Journey CRUD and versioning
 * - /sessions - Session viewer
 * - /channels - Telegram channel management
 * - /users - Channel users and activity
 * - /tags - Tag definitions
 * - /user-tags - User tag assignments
 * - /variables - Global and journey variables
 * - /events - Event logs and streaming
 * - /uploads - Media uploads
 * - /crm - CRM pipelines, clients, messaging
 * - /mindstates - Mindstate definitions
 * - /simulator - Journey testing
 * - /workflows - Agent workflow builder
 * - /llm - LLM module (models, tools, audio)
 * - /prompts - Prompt repository with versioning
 */
export function createApiRouter() {
  const router = new Hono<{ Variables: Variables }>();

  // -------------------------------------------------------------------------
  // Core Domain Routes
  // -------------------------------------------------------------------------

  // Journey routes - CRUD, versioning, activation
  router.route("/journeys", journeys);
  router.route("/journeys", journeyVersions);

  // Session routes - mounted at root level (/sessions endpoint)
  router.route("/", sessionsRoutes);

  // AI Report routes - mounted at root level (/sessions/:id/ai-report)
  router.route("/", aiReportRoutes);

  // Channel routes - Telegram channel management
  router.route("/channels", channels);

  // -------------------------------------------------------------------------
  // User and Client Routes
  // -------------------------------------------------------------------------

  // Users routes - list telegram users, activity
  router.route("/users", usersRoutes);

  // Tag definitions - organization-level tag registry
  router.route("/tags", tagDefinitions);

  // User tags - assign tags to users/sessions
  router.route("/user-tags", tags);

  // -------------------------------------------------------------------------
  // Configuration Routes
  // -------------------------------------------------------------------------

  // Variables - global and journey variables
  router.route("/variables", variables);

  // -------------------------------------------------------------------------
  // Event Routes
  // -------------------------------------------------------------------------

  // Events - logs, streaming, replay
  router.route("/events", events);

  // -------------------------------------------------------------------------
  // Media Routes
  // -------------------------------------------------------------------------

  // Uploads - media file management
  router.route("/uploads", uploads);

  // -------------------------------------------------------------------------
  // CRM Domain Routes
  // -------------------------------------------------------------------------

  // CRM - pipelines, stages, clients, messaging
  router.route("/crm", crm);

  // Mindstates - definitions and client mindstates
  router.route("/mindstates", mindstates);

  // -------------------------------------------------------------------------
  // Simulator Routes
  // -------------------------------------------------------------------------

  // Simulator - backend engine for journey testing
  router.route("/simulator", simulator);

  // -------------------------------------------------------------------------
  // Workflow Routes
  // -------------------------------------------------------------------------

  // Workflows - agent workflow builder
  router.route("/workflows", workflows);
  router.route("/workflows", workflowVersions);
  router.route("/workflows/approvals", workflowApprovalsRouter);

  // -------------------------------------------------------------------------
  // LLM Routes
  // -------------------------------------------------------------------------

  // LLM - models registry (public), tools discovery, audio STT/TTS
  router.route("/llm", llm);

  // -------------------------------------------------------------------------
  // Prompt Repository Routes
  // -------------------------------------------------------------------------

  // Prompts - versioned prompt management with caching
  router.route("/prompts", prompts);

  return router;
}

/**
 * Create the webhook router.
 *
 * Webhook routes are separate from the main API router because:
 * 1. They don't require auth middleware
 * 2. They have different rate limiting
 * 3. They're mounted at /webhook instead of /api
 */
export function createWebhookRouter() {
  const router = new Hono<{ Variables: Variables }>();

  // Telegram webhook - multi-tenant
  router.route("/telegram", telegramWebhook);

  return router;
}
