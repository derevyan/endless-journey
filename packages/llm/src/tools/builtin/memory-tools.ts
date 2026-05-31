/**
 * Memory Tools
 *
 * Tools for long-term memory storage and retrieval:
 * - save_memory: Save a fact about the user
 * - recall_memories: Search memories using semantic similarity
 *
 * @module tools/builtin/memory-tools
 */

import { serializeError } from "@journey/logger";
import type { AgentTool } from "@journey/schemas";
import { z } from "zod";
import type { BuiltinToolContext, ToolFactory } from "./types";
import { defaultServiceRetryConfig } from "./types";
import { SYSTEM_TOOL_NAMES } from "../unified/tool-names";

// =============================================================================
// SAVE MEMORY TOOL
// =============================================================================

/**
 * Create save_memory tool
 *
 * Saves a fact or preference about the user to long-term memory.
 * Memories persist across conversations and sessions.
 */
export const createSaveMemoryTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.SAVE_MEMORY,
    description:
      "Save a fact about the user to remember in future conversations. Use this to store important information like preferences, personal details, or context that should persist across sessions. Examples: user's name, food preferences, goals, important dates, etc.",
    schema: z
      .object({
        key: z.string().min(1).max(100).describe("A unique identifier for this memory (e.g., 'user_name', 'food_preference', 'birthday'). Use snake_case."),
        content: z.string().min(1).max(1000).describe("The fact or information to remember about the user"),
        memoryType: z
          .enum(["semantic", "preference"])
          .optional()
          .describe("Type of memory: 'semantic' for facts (default), 'preference' for explicit user preferences"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      actions: ["saveMemory"],
    },
    // Deferred by default - fire-and-forget, user sees response faster
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
    execute: async ({ key, content, memoryType }) => {
      if (!context.services.memory) {
        context.log.warn({ nodeId: context.nodeId }, "agent:tool:saveMemory:noService");
        return { error: "Memory not available", message: "Memory service is not enabled for this agent" };
      }

      try {
        await context.services.memory.save({
          key,
          content,
          memoryType: memoryType as "semantic" | "preference" | undefined,
        });

        context.log.debug({ key, contentLength: content.length }, "agent:tool:saveMemory:success");
        return {
          success: true,
          message: `Remembered: ${key}`,
          key,
        };
      } catch (error) {
        context.log.error({ err: serializeError(error), key }, "agent:tool:saveMemory:failed");
        return { error: "Save failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// RECALL MEMORIES TOOL
// =============================================================================

/**
 * Create recall_memories tool
 *
 * Searches through long-term memories using semantic similarity.
 * Returns the most relevant memories for the given query.
 */
export const createRecallMemoriesTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.RECALL_MEMORIES,
    description:
      "Search your memories about this user. Use this when you need to remember something from past conversations, like their name, preferences, or previous context. Returns the most relevant memories based on semantic similarity.",
    schema: z
      .object({
        query: z
          .string()
          .min(1)
          .max(500)
          .describe("What are you trying to remember? Describe in natural language (e.g., 'user name', 'food preferences', 'their goals')"),
        limit: z.number().int().min(1).max(10).optional().describe("Maximum number of memories to return (default: 5)"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      actions: ["recallMemory"],
    },
    // Fixed immediate - LLM needs search results to respond
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs search results to respond",
    },
    execute: async ({ query, limit }) => {
      if (!context.services.memory) {
        context.log.warn({ nodeId: context.nodeId }, "agent:tool:recallMemories:noService");
        return { error: "Memory not available", message: "Memory service is not enabled for this agent" };
      }

      try {
        const memories = await context.services.memory.search(query, limit ?? 5);

        context.log.debug({ query: query.substring(0, 50), found: memories.length }, "agent:tool:recallMemories:success");

        if (memories.length === 0) {
          return {
            found: false,
            message: "No relevant memories found for this query",
            memories: [],
          };
        }

        return {
          found: true,
          count: memories.length,
          memories: memories.map((m) => ({
            key: m.key,
            content: m.content,
            type: m.memoryType,
            relevance: Math.round(m.similarity * 100) / 100, // Round to 2 decimals
          })),
        };
      } catch (error) {
        context.log.error({ err: serializeError(error), query }, "agent:tool:recallMemories:failed");
        return { error: "Search failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// BUILDER FUNCTION
// =============================================================================

export interface MemoryToolConfig {
  saveMemory?: boolean;
  recallMemories?: boolean;
}

/**
 * Build memory tools based on configuration
 *
 * @param context - Built-in tool context with memory service
 * @param config - Which memory tools to enable
 * @returns Array of enabled memory tools
 */
export function buildMemoryTools(context: BuiltinToolContext, config: MemoryToolConfig): AgentTool[] {
  const tools: AgentTool[] = [];

  // Only add tools if memory service is available
  if (!context.services.memory) {
    return tools;
  }

  if (config.saveMemory) {
    tools.push(createSaveMemoryTool(context));
  }

  if (config.recallMemories) {
    tools.push(createRecallMemoriesTool(context));
  }

  return tools;
}
