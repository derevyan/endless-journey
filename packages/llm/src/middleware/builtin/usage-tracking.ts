/**
 * Usage Tracking Middleware
 *
 * Automatically tracks LLM token usage and costs for all model calls
 * made during agent execution. Uses UsageTrackingService for persistence.
 *
 * @example
 * ```typescript
 * const agent = await executeAgentWithMiddleware(
 *   systemPrompt,
 *   messages,
 *   {
 *     model: "gpt-4o",
 *     middleware: {
 *       middleware: [
 *         createUsageTrackingMiddleware({
 *           service: "agent-workflow", // Use LLM_SERVICE_NAMES constants
 *         }),
 *       ],
 *     },
 *     runtime: {
 *       orgId: "org_123",
 *       sessionId: "session_456",
 *     },
 *   }
 * );
 * ```
 */

import { z } from "zod";
import { createMiddleware } from "../create-middleware";
import { createLogger } from "@journey/logger";
import { getStateNumber } from "../utils";
import { getUsageTrackingAdapter } from "../../adapters/usage-tracking-context";
import type { TokenUsage as CanonicalTokenUsage } from "@journey/schemas";

const log = createLogger("llm:middleware:usage-tracking");

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for Usage Tracking middleware
 */
export interface UsageTrackingMiddlewareConfig {
  /**
   * Service name for tracking context
   * e.g., "agent-handler", "question-understanding"
   */
  service: string;

  /**
   * Optional module name within the service
   * e.g., "worker-1", "evaluator"
   */
  module?: string;

  /**
   * Whether to track individual model calls
   * If false, only aggregated totals are tracked
   * @default true
   */
  trackIndividualCalls?: boolean;

  /**
   * Custom provider override (auto-detected if not provided)
   */
  provider?: string;
}

// ============================================================================
// State Schema
// ============================================================================

const usageTrackingStateSchema = z.object({
  /** Total prompt tokens for this agent run */
  _mwUsageTotalPromptTokens: z.number().default(0),

  /** Total completion tokens for this agent run */
  _mwUsageTotalCompletionTokens: z.number().default(0),

  /** Total tokens for this agent run */
  _mwUsageTotalTokens: z.number().default(0),

  /** Total cost in USD for this agent run */
  _mwUsageTotalCostUSD: z.number().default(0),

  /** Number of model calls made (usage tracking specific) */
  _mwUsageCallCount: z.number().default(0),

  /** Model call start time (for duration tracking) */
  _mwUsageModelStartTime: z.number().default(0),
});

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create a Usage Tracking middleware
 *
 * Tracks token usage for every model call and persists to database.
 * Requires runtime context (orgId) for multi-tenant tracking.
 *
 * @example Basic usage
 * ```typescript
 * createUsageTrackingMiddleware({ service: "agent-workflow" })
 * ```
 *
 * @example With module
 * ```typescript
 * createUsageTrackingMiddleware({
 *   service: "question-understanding",
 *   module: "worker-1",
 * })
 * ```
 */
export function createUsageTrackingMiddleware(config: UsageTrackingMiddlewareConfig) {
  const { service, module, trackIndividualCalls = true, provider: configProvider } = config;

  return createMiddleware({
    name: "UsageTrackingMiddleware",
    priority: 35, // Run after limits (20), before tool injection (40-50)
    stateSchema: usageTrackingStateSchema,

    // Track model call start time for duration measurement
    beforeModel: () => {
      return { _mwUsageModelStartTime: Date.now() };
    },

    afterModel: async (state, runtime, response) => {
      // Skip if no usage data
      if (!response.usage) {
        log.trace("middleware:usageTracking:noUsageData");
        return;
      }

      const { promptTokens, completionTokens, totalTokens, costUSD } = response.usage;

      // Calculate duration from beforeModel timestamp
      const startTime = getStateNumber(state, "_mwUsageModelStartTime");
      const durationMs = startTime > 0 ? Date.now() - startTime : undefined;

      // Get current totals from state
      const currentPromptTokens = getStateNumber(state, "_mwUsageTotalPromptTokens");
      const currentCompletionTokens = getStateNumber(state, "_mwUsageTotalCompletionTokens");
      const currentTotalTokens = getStateNumber(state, "_mwUsageTotalTokens");
      const currentCostUSD = getStateNumber(state, "_mwUsageTotalCostUSD");
      const callCount = getStateNumber(state, "_mwUsageCallCount");

      // Calculate new totals
      const newPromptTokens = currentPromptTokens + promptTokens;
      const newCompletionTokens = currentCompletionTokens + completionTokens;
      const newTotalTokens = currentTotalTokens + totalTokens;
      const newCostUSD = currentCostUSD + (costUSD ?? 0);

      // Determine finish reason
      const finishReason = response.toolCalls?.length ? "tool_calls" : "stop";

      // Track individual call if enabled
      if (trackIndividualCalls && runtime.orgId) {
        // TokenUsage already uses canonical format from @journey/schemas
        const canonicalUsage: CanonicalTokenUsage = {
          promptTokens,
          completionTokens,
          totalTokens,
          costUSD,
        };

        // Convert middleware message format to schema format
        const inputMessages = state.messages.map((msg) => ({
          role: msg.role as "user" | "assistant" | "system" | "tool",
          content: msg.content,
          toolCallId: msg.toolCallId,
        }));

        // Convert tool calls format
        const outputToolCalls = response.toolCalls?.map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
        }));

        // Use response.modelUsed when available (set by fallback middleware)
        // This is CRITICAL for accurate billing when fallback occurs
        const actualModel = response.modelUsed ?? state.model;

        // Guard against recording usage before adapter initialization
        const adapter = getUsageTrackingAdapter();
        if (!adapter.isReady?.()) {
          log.trace(
            { organizationId: runtime.orgId, model: actualModel },
            "middleware:usageTracking:adapterNotReady"
          );
          return; // Skip recording but don't fail
        }

        adapter.recordUsage(canonicalUsage, {
          organizationId: runtime.orgId,
          journeySessionId: runtime.journeyId ? runtime.sessionId : undefined,
          service,
          module,
          model: actualModel,
          provider: configProvider ?? "unknown",
          durationMs,

          // I/O Content for debugging
          systemPrompt: state.systemPrompt,
          inputMessages,
          outputContent: response.content,
          outputToolCalls,
          finishReason,
        });
      } else if (!runtime.orgId) {
        log.trace(
          { service, model: state.model },
          "middleware:usageTracking:skipped:noOrgId"
        );
      }

      log.trace(
        {
          callNumber: callCount + 1,
          tokens: totalTokens,
          cost: costUSD,
          durationMs,
          runningTotal: newTotalTokens,
        },
        "middleware:usageTracking:recorded"
      );

      // Update state with new totals
      return {
        _mwUsageTotalPromptTokens: newPromptTokens,
        _mwUsageTotalCompletionTokens: newCompletionTokens,
        _mwUsageTotalTokens: newTotalTokens,
        _mwUsageTotalCostUSD: newCostUSD,
        _mwUsageCallCount: callCount + 1,
      };
    },

    afterAgent: (state, runtime) => {
      // Log final totals
      const totalTokens = getStateNumber(state, "_mwUsageTotalTokens");
      const totalCost = getStateNumber(state, "_mwUsageTotalCostUSD");
      const callCount = getStateNumber(state, "_mwUsageCallCount");

      if (callCount > 0) {
        log.debug(
          {
            service,
            module,
            orgId: runtime.orgId,
            totalCalls: callCount,
            totalTokens,
            totalCostUSD: totalCost.toFixed(6),
          },
          "middleware:usageTracking:agentComplete"
        );
      }
    },
  });
}

