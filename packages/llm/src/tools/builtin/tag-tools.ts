/**
 * Tag Management Tools
 *
 * Tools for managing user tags:
 * - add_user_tags: Add tags to the current user
 * - remove_user_tags: Remove tags from the current user
 * - get_user_tags: Get all tags for the current user
 *
 * @module tools/builtin/tag-tools
 */

import { serializeError } from "@journey/logger";
import type { AgentTool } from "@journey/schemas";
import { z } from "zod";
import type { BuiltinToolContext, ToolFactory } from "./types";
import { defaultServiceRetryConfig } from "./types";
import { SYSTEM_TOOL_NAMES } from "../unified/tool-names";

// =============================================================================
// ADD USER TAGS TOOL
// =============================================================================

/**
 * Create add_user_tags tool
 *
 * Adds one or more tags to the current user.
 */
export const createAddUserTagsTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.ADD_USER_TAGS,
    description:
      "Add one or more tags to the current user. Tags are global identifiers that follow the user across all journeys and can be used for segmentation and filtering.",
    schema: z
      .object({
        tags: z.array(z.string()).min(1).describe("Array of tag names to add (e.g., ['vip', 'interested'])"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      tags: { write: true },
      actions: ["tagWrite"],
    },
    // Deferred by default - fire-and-forget side effect
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
    execute: async ({ tags }) => {
      if (!context.services.tag) {
        context.log.warn({ tags }, "agent:tool:addUserTags:serviceNotAvailable");
        return { error: "Not available", message: "Tag service is not configured" };
      }

      try {
        await context.services.tag.executeTagAction(tags, []);
        context.log.debug({ tags }, "agent:tool:addUserTags:success");
        return { success: true, added: tags };
      } catch (error) {
        context.log.error({ err: serializeError(error), tags }, "agent:tool:addUserTags:failed");
        return { error: "Add failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// REMOVE USER TAGS TOOL
// =============================================================================

/**
 * Create remove_user_tags tool
 *
 * Removes one or more tags from the current user.
 */
export const createRemoveUserTagsTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.REMOVE_USER_TAGS,
    description:
      "Remove one or more tags from the current user. Tags are global identifiers used for segmentation that persist across all journeys. Use when a user no longer fits a segment (e.g., unsubscribed, completed onboarding).",
    schema: z
      .object({
        tags: z.array(z.string()).min(1).describe("Array of tag names to remove"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      tags: { write: true },
      actions: ["tagWrite"],
    },
    // Deferred by default - fire-and-forget side effect
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
    execute: async ({ tags }) => {
      if (!context.services.tag) {
        context.log.warn({ tags }, "agent:tool:removeUserTags:serviceNotAvailable");
        return { error: "Not available", message: "Tag service is not configured" };
      }

      try {
        await context.services.tag.executeTagAction([], tags);
        context.log.debug({ tags }, "agent:tool:removeUserTags:success");
        return { success: true, removed: tags };
      } catch (error) {
        context.log.error({ err: serializeError(error), tags }, "agent:tool:removeUserTags:failed");
        return { error: "Remove failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// GET USER TAGS TOOL
// =============================================================================

/**
 * Create get_user_tags tool
 *
 * Gets all tags currently assigned to the user.
 */
export const createGetUserTagsTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.GET_USER_TAGS,
    description: "Get all tags currently assigned to the user.",
    schema: z.object({}).loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      tags: { read: true },
      actions: ["tagRead"],
    },
    // Fixed immediate - LLM needs tags to make decisions
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs tags to make decisions",
    },
    execute: async () => {
      if (!context.services.tag) {
        context.log.warn({}, "agent:tool:getUserTags:serviceNotAvailable");
        return { error: "Not available", message: "Tag service is not configured" };
      }

      try {
        const tags = await context.services.tag.getTags();
        context.log.debug({ count: tags.length }, "agent:tool:getUserTags:success");
        return { tags };
      } catch (error) {
        context.log.error({ err: serializeError(error) }, "agent:tool:getUserTags:failed");
        return { error: "Get failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Build all tag tools based on configuration
 *
 * @param context - Built-in tool context
 * @param config - Which tools to enable
 * @returns Array of enabled tag tools
 */
export function buildTagTools(
  context: BuiltinToolContext,
  config: {
    addTags?: boolean;
    removeTags?: boolean;
    getTags?: boolean;
  }
): AgentTool[] {
  const tools: AgentTool[] = [];

  if (config.addTags) {
    tools.push(createAddUserTagsTool(context));
  }
  if (config.removeTags) {
    tools.push(createRemoveUserTagsTool(context));
  }
  if (config.getTags) {
    tools.push(createGetUserTagsTool(context));
  }

  return tools;
}
