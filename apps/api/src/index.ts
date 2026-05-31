/**
 * Journey API Server
 *
 * Main entry point that starts the API server.
 *
 * ## Endpoints
 *
 * ### Health
 * - GET  /health                    - Health check
 *
 * ### Authentication (Better Auth)
 * - ALL  /api/auth/*                - Better Auth endpoints (login, signup, session, etc.)
 *
 * ### Journeys (Authenticated)
 * - GET    /api/journeys            - List user's journeys
 * - GET    /api/journeys/:id        - Get journey by ID/slug
 * - POST   /api/journeys            - Create new journey
 * - PUT    /api/journeys/:id        - Update journey
 * - DELETE /api/journeys/:id        - Delete journey
 *
 * ### Bots (Authenticated)
 * - GET    /api/bots                - List user's bots
 * - GET    /api/bots/:id            - Get bot by ID
 * - POST   /api/bots                - Create new bot (validates token with Telegram)
 * - PUT    /api/bots/:id            - Update bot (default journey, active status)
 * - DELETE /api/bots/:id            - Delete bot (removes webhook)
 * - POST   /api/bots/:id/webhook    - Re-register webhook
 *
 * ### Telegram Webhook
 * - POST /webhook/telegram/:channelId   - Telegram webhook handler
 *
 * ### Sessions (Authenticated)
 * - GET  /journeys/:journeyId/sessions  - List sessions for journey
 * - GET  /sessions/:sessionId           - Get session detail
 * - DELETE /sessions/:sessionId         - Delete session
 * - DELETE /journeys/:journeyId/sessions - Reset all sessions (dev only)
 *
 * @module api
 */

// Load .env FIRST - before any other imports that might read env vars
import "dotenv/config";

import { serve } from "@hono/node-server";
import { createLogger, serializeError } from "@journey/logger";
import { db } from "@journey/db";

import { app } from "./app";
import { appConfig } from "./config";
import { initAutomationEventService, shutdownAutomationEventService } from "./event-bus/automation";
import { publishers } from "./event-bus/publishers";
import { closeRedisConnection } from "./lib/redis";
import { handleAutomationEvent } from "./services/automation-handler";
import { initDataRetentionService, shutdownDataRetentionService } from "./services/data-retention";
import { handleTimerFired, initTimerService, recoverTimers, shutdownTimerService, shutdownApprovalTimerService } from "./services/timers";
import { initApprovalService } from "./modules/workflows";
import { initWorkflowExecutors } from "./modules/workflows/init";

// Event Bus
import { automationConsumer, initAutomationConsumerQueue, logConsumer, shutdownAutomationConsumerQueue, sseConsumer } from "./event-bus/consumers";
import { initEventBus, registerEventConsumer, shutdownEventBus } from "./event-bus/event-bus";
import { setupBullBoard } from "./services/bull-board";

// MCP Service Client (connects to standalone MCP service)
import { initMCPServiceClient } from "@journey/mcp";

const log = createLogger("api");

log.info({ env: appConfig.env.nodeEnv }, "api:boot");

// =============================================================================
// SERVICE INITIALIZATION
// =============================================================================

async function initializeServices(): Promise<void> {
  // LLM service uses LangChain's initChatModel which auto-detects providers
  // from model names and reads API keys from environment automatically
  // (OPENAI_API_KEY, GOOGLE_API_KEY/GEMINI_API_KEY, ANTHROPIC_API_KEY)

  // Register built-in tools (explicit registration, not auto on import)
  try {
    const { registerBuiltinTools } = await import("@journey/llm/tools");
    await registerBuiltinTools();
    log.info({}, "api:tools:registered");
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:tools:registerFailed");
    // Don't exit - API can still work with limited tools
    log.warn({}, "api:tools:failed - Built-in tools may not be available");
  }

  // Initialize model registry adapter (loads full registry from essential-models.ts)
  try {
    const { EssentialModelAdapter } = await import("@journey/llm/adapters");
    const { setModelRegistryAdapter } = await import("@journey/llm/server");
    const adapter = new EssentialModelAdapter();
    setModelRegistryAdapter(adapter);
    log.info({}, "api:modelRegistry:initialized");
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:modelRegistry:initFailed");
    // Don't exit - API can still work with fallback static pricing (NoopAdapter)
    log.warn({}, "api:modelRegistry:failed - Using fallback static pricing");
  }

  // Initialize LLM server services (model registry + usage tracking adapter setup)
  try {
    const { initializeServerServices } = await import("@journey/llm/server");
    initializeServerServices(); // Sets up usage tracking adapter + initializes service
    log.info({}, "api:llmServerServices:initialized");
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:llmServerServices:initFailed");
    // Don't exit - API can still work without usage tracking
    log.warn({}, "api:llmServerServices:failed - Token usage will not be tracked to database");
  }

  // Register workflow executors once at startup (idempotent)
  initWorkflowExecutors();

  // Initialize MCP service client (connects to standalone MCP service via HTTP)
  // The MCP service (apps/mcp) manages MCP servers independently
  try {
    const { serviceUrl, serviceTimeoutMs } = appConfig.mcp;
    const client = initMCPServiceClient({
      baseUrl: serviceUrl,
      timeout: serviceTimeoutMs,
    });

    // Check if MCP service is available
    const isAvailable = await client.isAvailable();
    if (isAvailable) {
      log.info({ url: serviceUrl }, "api:mcpServiceClient:initialized - Connected to MCP service");
    } else {
      log.warn({ url: serviceUrl }, "api:mcpServiceClient:unavailable - MCP service not responding (will retry on tool calls)");
    }
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:mcpServiceClient:initFailed");
    // Don't exit - API can still work without MCP tools (embedded tools still available)
    log.warn({}, "api:mcpServiceClient:failed - MCP tools will not be available for agents");
  }

  // Initialize event bus (unified event system)
  try {
    // Register all event consumers
    registerEventConsumer(sseConsumer);
    registerEventConsumer(automationConsumer);
    registerEventConsumer(logConsumer);

    // Initialize automation consumer queue (needs Redis)
    initAutomationConsumerQueue();

    // Start the event bus
    initEventBus();
    log.info({}, "api:eventBus:initialized");
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:eventBus:initFailed");
    log.warn({}, "api:eventBus:redisRequired - Event bus failed to initialize. Events will not be published.");
  }

  // Initialize timer service (for wait nodes)
  try {
    await initTimerService(handleTimerFired);
    log.info({}, "api:timerService:initialized");

    // Recover timers after service is initialized
    try {
      await recoverTimers();
      log.info({}, "api:timerRecovery:completed");
    } catch (error) {
      log.error({ err: serializeError(error) }, "api:timerRecovery:failed");
      // Don't exit - timers will still work, just missed ones won't be recovered
    }
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:timerService:initFailed");
    // Don't exit - API can still work without timers (wait nodes won't fire)
    log.warn({}, "api:timerService:redisRequired - Timer service failed to initialize. Wait nodes will not work. Make sure Redis is running (REDIS_URL)");
  }

  // Initialize automation event service (for event-driven automations)
  try {
    await initAutomationEventService(handleAutomationEvent);
    log.info({}, "api:automationEventService:initialized");
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:automationEventService:initFailed");
    // Don't exit - API can still work without automation events
    log.warn({}, "api:automationEventService:redisRequired - Automation event service failed to initialize. Event-driven automations will not work.");
  }

  // Initialize data retention service (for cleaning up old data from multiple tables)
  try {
    await initDataRetentionService();
    log.info({}, "api:dataRetentionService:initialized");
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:dataRetentionService:initFailed");
    // Don't exit - API can still work without retention
    log.warn({}, "api:dataRetentionService:failed - Data retention service failed to initialize. Old data will not be cleaned up automatically.");
  }

  // Initialize workflow approval service (for user approval nodes)
  try {
    await initApprovalService({
      db,
      organizationId: "system",
      publisher: publishers,
    });
    log.info({}, "api:approvalService:initialized");
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:approvalService:initFailed");
    // Don't exit - API can still work without approval service
    log.warn({}, "api:approvalService:redisRequired - Approval service failed to initialize. User approval nodes will not work.");
  }
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

async function gracefulShutdown(signal: string): Promise<void> {
  log.info({ signal }, "api:shutdown:starting - Shutting down gracefully...");

  try {
    // Shutdown services in reverse order of initialization
    await shutdownApprovalTimerService();
    await shutdownDataRetentionService();
    await shutdownAutomationEventService();
    await shutdownTimerService();
    await shutdownAutomationConsumerQueue();
    shutdownEventBus();

    // Flush usage tracking buffer before shutdown
    try {
      const { usageTrackingService } = await import("@journey/llm/server");
      await usageTrackingService.shutdown();
    } catch {
      // Ignore - service may not have been initialized
    }

    // Note: MCPServiceClient uses HTTP with circuit breaker - no explicit shutdown needed
    // The standalone MCP service (apps/mcp) manages its own lifecycle

    await closeRedisConnection();
    log.info({}, "api:shutdown:complete");
    process.exit(0);
  } catch (error) {
    log.error({ err: serializeError(error) }, "api:shutdown:error");
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// =============================================================================
// SERVER START
// =============================================================================

const port = appConfig.server.port;

// Initialize services then start server
initializeServices().then(() => {
  // Setup Bull Board (dev-only)
  const isDevelopment = appConfig.env.isDevelopment;
  if (isDevelopment) {
    try {
      setupBullBoard(app);
      log.info({}, "api:bullBoard:initialized - Queue monitoring available at /admin/queues");
    } catch (error) {
      log.warn({ err: serializeError(error) }, "api:bullBoard:initFailed - Bull Board failed to initialize");
    }
  }

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      log.info({ port: info.port, url: `http://localhost:${info.port}` }, "api:server:started");
    }
  );
});

export default app;
