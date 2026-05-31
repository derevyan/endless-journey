/**
 * Journey Tools
 *
 * Tools for journey routing and session management:
 * - start_journey: Start user in a different journey (validates allowlist)
 * - list_journeys: List available journeys for AI routing decisions
 * - get_active_journeys: Get user's current active journey sessions
 *
 * @module tools/builtin/journey-tools
 */

import { serializeError } from "@journey/logger";
import type { AgentTool } from "@journey/schemas";
import { z } from "zod";
import type { BuiltinToolContext, ToolFactory } from "./types";
import { defaultServiceRetryConfig } from "./types";
import { SYSTEM_TOOL_NAMES } from "../unified/tool-names";

// =============================================================================
// START JOURNEY TOOL
// =============================================================================

/**
 * Create start_journey tool
 *
 * Routes the user to a different journey. The current session is paused
 * and can be resumed later. Validates that the target journey is in the
 * current journey's transfer allowlist.
 */
export const createStartJourneyTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.START_JOURNEY,
    description:
      "Route the user to a different journey. Use this when the user needs to go through a specialized flow " +
      "(e.g., onboarding, support, sales, checkout). The current journey session will be paused and can be resumed later. " +
      "You can only route to journeys that are in this journey's transfer allowlist.",
    schema: z
      .object({
        journeyId: z.string().min(1).describe("The ID of the journey to route the user to. Use list_journeys to see available options."),
        reason: z.string().max(500).optional().describe("Brief explanation of why you're routing to this journey (for logging/context)"),
        preserveContext: z.boolean().optional().default(true).describe("Whether to carry over context data to the new journey (default: true)"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      actions: ["startJourney", "routeUser"],
    },
    // Deferred by default - user sees goodbye message first
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
    execute: async ({ journeyId, reason, preserveContext }) => {
      if (!context.services.journey) {
        context.log.warn({ nodeId: context.nodeId }, "agent:tool:startJourney:noService");
        return {
          success: false,
          error: "Journey routing is not available for this agent",
        };
      }

      try {
        const result = await context.services.journey.startUserInJourney(context.session.userId, journeyId, {
          preserveContext: preserveContext ?? true,
          currentSessionAction: "pause",
          reason,
        });

        if (result.success) {
          context.log.info({ journeyId, reason, sessionId: result.sessionId }, "agent:tool:startJourney:success");
          return {
            success: true,
            message: `User is now in journey ${journeyId}`,
            newSessionId: result.sessionId,
            previousSessionId: result.previousSessionId,
          };
        } else {
          context.log.warn({ journeyId, error: result.error, errorMessage: result.errorMessage }, "agent:tool:startJourney:failed");
          return {
            success: false,
            error: result.error,
            message: result.errorMessage,
          };
        }
      } catch (error) {
        context.log.error({ err: serializeError(error), journeyId }, "agent:tool:startJourney:error");
        return {
          success: false,
          error: "routing_failed",
          message: String(error),
        };
      }
    },
  };
};

// =============================================================================
// LIST JOURNEYS TOOL
// =============================================================================

/**
 * Create list_journeys tool
 *
 * Lists available journeys that the AI can route users to.
 * By default, only shows journeys in the current journey's allowlist.
 */
export const createListJourneysTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.LIST_JOURNEYS,
    description:
      "Get a list of journeys you can route the user to. Returns journey names and descriptions " +
      "to help you decide which journey is appropriate. Only shows journeys in the transfer allowlist.",
    schema: z
      .object({
        search: z.string().max(100).optional().describe("Optional search term to filter journeys by name or description"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      actions: ["listJourneys"],
    },
    // Fixed immediate - LLM needs list to choose from
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs list to choose from",
    },
    execute: async ({ search }) => {
      if (!context.services.journey) {
        context.log.warn({ nodeId: context.nodeId }, "agent:tool:listJourneys:noService");
        return {
          journeys: [],
          message: "Journey routing is not available for this agent",
        };
      }

      try {
        const journeys = await context.services.journey.listJourneys({
          allowlistOnly: true,
          search,
          limit: 20,
        });

        context.log.debug({ count: journeys.length, search }, "agent:tool:listJourneys:success");

        if (journeys.length === 0) {
          return {
            count: 0,
            journeys: [],
            message: search ? "No matching journeys found in the allowlist" : "No journeys available for routing (allowlist is empty)",
          };
        }

        return {
          count: journeys.length,
          journeys: journeys.map((j) => ({
            id: j.id,
            name: j.name,
            description: j.description,
          })),
        };
      } catch (error) {
        context.log.error({ err: serializeError(error) }, "agent:tool:listJourneys:error");
        return {
          journeys: [],
          error: "Failed to list journeys",
        };
      }
    },
  };
};

// =============================================================================
// GET ACTIVE JOURNEYS TOOL
// =============================================================================

/**
 * Create get_active_journeys tool
 *
 * Gets the user's current active and paused journey sessions.
 * Useful for understanding the user's context across journeys.
 */
export const createGetActiveJourneysTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.GET_ACTIVE_JOURNEYS,
    description:
      "Get the user's current active and paused journey sessions. " +
      "Use this to understand what other journeys the user is currently engaged with, " +
      "or to check if they have a paused session you could reference.",
    schema: z.object({}).loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      actions: ["getActiveJourneys"],
    },
    // Fixed immediate - LLM needs sessions info
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs sessions info",
    },
    execute: async () => {
      if (!context.services.journey) {
        context.log.warn({ nodeId: context.nodeId }, "agent:tool:getActiveJourneys:noService");
        return {
          sessions: [],
          message: "Journey routing is not available for this agent",
        };
      }

      try {
        const sessions = await context.services.journey.getUserActiveJourneys(context.session.userId);

        context.log.debug({ count: sessions.length }, "agent:tool:getActiveJourneys:success");

        return {
          count: sessions.length,
          currentJourneyId: context.session.journeyId,
          sessions: sessions.map((s) => ({
            journeyId: s.journeyId,
            journeyName: s.journeyName,
            status: s.status,
            startedAt: s.startedAt.toISOString(),
            isCurrent: s.journeyId === context.session.journeyId,
          })),
        };
      } catch (error) {
        context.log.error({ err: serializeError(error) }, "agent:tool:getActiveJourneys:error");
        return {
          sessions: [],
          error: "Failed to get active journeys",
        };
      }
    },
  };
};

// =============================================================================
// BUILDER FUNCTION
// =============================================================================

export interface JourneyToolConfig {
  startJourney?: boolean;
  listJourneys?: boolean;
  getActiveJourneys?: boolean;
}

/**
 * Build journey tools based on configuration
 *
 * @param context - Built-in tool context with journey service
 * @param config - Which journey tools to enable
 * @returns Array of enabled journey tools
 */
export function buildJourneyTools(context: BuiltinToolContext, config: JourneyToolConfig): AgentTool[] {
  const tools: AgentTool[] = [];

  // Only add tools if journey service is available
  if (!context.services.journey) {
    return tools;
  }

  if (config.startJourney) {
    tools.push(createStartJourneyTool(context));
  }

  if (config.listJourneys) {
    tools.push(createListJourneysTool(context));
  }

  if (config.getActiveJourneys) {
    tools.push(createGetActiveJourneysTool(context));
  }

  return tools;
}
