/**
 * Context and Profile Tools
 *
 * Tools for accessing user profile and journey context:
 * - get_user_profile: Get user information and profile variables
 * - get_journey_context: Get current journey state and context
 *
 * @module tools/builtin/context-tools
 */

import { serializeError } from "@journey/logger";
import type { AgentTool } from "@journey/schemas";
import { z } from "zod";
import type { BuiltinToolContext, ToolFactory } from "./types";
import { defaultServiceRetryConfig } from "./types";
import { SYSTEM_TOOL_NAMES } from "../unified/tool-names";

// =============================================================================
// USER PROFILE TOOL
// =============================================================================

/**
 * Create get_user_profile tool
 *
 * Returns user profile information including name, platform, and user variables.
 */
export const createUserProfileTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.GET_USER_PROFILE,
    description: "Get user profile information including name, platform, and user variables",
    schema: z.object({}).loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      variables: { read: ["user"] },
      actions: ["readContext"],
    },
    // Fixed immediate - LLM needs profile data
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs profile data",
    },
    execute: async () => {
      try {
        const userVars = await context.services.variable.getAll("user");

        const profile = {
          id: context.clientData?.id ?? context.session.userId,
          platform: context.clientData?.platform || "unknown",
          firstName: context.clientData?.firstName,
          lastName: context.clientData?.lastName,
          username: context.clientData?.username,
          tags: context.session.tags || [],
          userVars,
        };

        context.log.debug({ userId: profile.id }, "agent:tool:getUserProfile");
        return profile;
      } catch (error) {
        context.log.error({ err: serializeError(error) }, "agent:tool:getUserProfile:failed");
        return { error: "Failed to get user profile", message: String(error) };
      }
    },
  };
};

// =============================================================================
// JOURNEY CONTEXT TOOL
// =============================================================================

/**
 * Create get_journey_context tool
 *
 * Returns current journey state including variables, tags, and node outputs.
 */
export const createJourneyContextTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.GET_JOURNEY_CONTEXT,
    description: "Get current journey context including variables, tags, and node outputs",
    schema: z.object({}).loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      variables: { read: ["journey"] },
      actions: ["readContext"],
    },
    // Fixed immediate - LLM needs context data
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs context data",
    },
    execute: async () => {
      try {
        const journeyVars = await context.services.variable.getAll("journey");

        const contextInfo = {
          sessionId: context.session.sessionId,
          journeyId: context.session.journeyId,
          currentNodeId: context.session.currentNodeId,
          journeyVariables: journeyVars,
          sessionContext: context.session.context || {},
          tags: context.session.tags || [],
          nodeOutputs: context.session.nodeOutputs || {},
        };

        context.log.debug({ sessionId: context.session.sessionId }, "agent:tool:getJourneyContext");
        return contextInfo;
      } catch (error) {
        context.log.error({ err: serializeError(error) }, "agent:tool:getJourneyContext:failed");
        return { error: "Failed to get journey context", message: String(error) };
      }
    },
  };
};

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Build context tools based on configuration
 *
 * @param context - Built-in tool context
 * @param config - Which tools to enable
 * @returns Array of enabled context tools
 */
export function buildContextTools(
  context: BuiltinToolContext,
  config: {
    getUserProfile?: boolean;
    getJourneyContext?: boolean;
  }
): AgentTool[] {
  const tools: AgentTool[] = [];

  if (config.getUserProfile) {
    tools.push(createUserProfileTool(context));
  }
  if (config.getJourneyContext) {
    tools.push(createJourneyContextTool(context));
  }

  return tools;
}
