/**
 * Journey Tools Registration
 *
 * Registers journey routing tools with the unified registry.
 * These tools require the journey service to be available.
 *
 * Tools:
 * - start_journey: Route user to a different journey
 * - list_journeys: List available journeys for routing
 * - get_active_journeys: Get user's current journey sessions
 *
 * @module tools/unified/register-journey
 */

import { createLogger } from "@journey/logger";

// Registry
import { unifiedToolRegistry } from "./registry";
import { SYSTEM_TOOL_NAMES } from "./tool-names";

// Tool factories
import {
  createGetActiveJourneysTool,
  createListJourneysTool,
  createStartJourneyTool,
} from "../builtin/journey-tools";

const log = createLogger("llm:tools:unified");

// ============================================================================
// IDEMPOTENT REGISTRATION GUARD
// ============================================================================

let journeyToolsRegistered = false;

/**
 * Register all journey tools with the unified registry
 *
 * This function is idempotent - calling it multiple times has no effect
 * after the first call. This prevents duplicate registration when modules
 * are imported multiple times (common in test environments).
 */
export function registerJourneyTools(): void {
  if (journeyToolsRegistered) {
    log.debug({}, "tools:unified:journeyToolsAlreadyRegistered");
    return;
  }
  journeyToolsRegistered = true;

  // ==========================================================================
  // JOURNEY TOOLS
  // ==========================================================================

  unifiedToolRegistry.registerSystem(createStartJourneyTool, {
    name: SYSTEM_TOOL_NAMES.START_JOURNEY,
    displayName: "Start Journey",
    description: "Route the user to a different journey (validates allowlist)",
    category: "journey",
    requiredServices: ["journey"],
    usageExample: "If user wants to sign up or switch context, use tool 'start_journey' to route them",
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
  });

  unifiedToolRegistry.registerSystem(createListJourneysTool, {
    name: SYSTEM_TOOL_NAMES.LIST_JOURNEYS,
    displayName: "List Journeys",
    description: "List available journeys for AI routing decisions",
    category: "journey",
    requiredServices: ["journey"],
    usageExample: "If you need to see what other journeys are valid targets, use tool 'list_journeys' to find them",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs journey list to make routing decision",
    },
  });

  unifiedToolRegistry.registerSystem(createGetActiveJourneysTool, {
    name: SYSTEM_TOOL_NAMES.GET_ACTIVE_JOURNEYS,
    displayName: "Get Active Journeys",
    description: "Get user's current active and paused journey sessions",
    category: "journey",
    requiredServices: ["journey"],
    usageExample: "If you need to check if user has other active sessions, use tool 'get_active_journeys' to list them",
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs active sessions to respond",
    },
  });

  // ==========================================================================
  // INITIALIZATION COMPLETE
  // ==========================================================================

  log.debug(
    { count: unifiedToolRegistry.getCounts().system },
    "tools:unified:journeyToolsRegistered"
  );
}

// NOTE: Tools are registered explicitly via registerBuiltinTools() call
// in @journey/llm/tools/unified/index.ts, not automatically on import.
// This function is exported for explicit control and testing.
