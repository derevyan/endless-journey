/**
 * Messaging & Journey Routing Tools
 *
 * Tools for agent-user communication and journey navigation:
 * - send_message: Send messages with optional buttons and media
 * - exit_to_next_node: Exit current agent and transition to next journey node
 *
 * @module tools/builtin/messaging-tools
 */

import { serializeError } from "@journey/logger";
import type { AgentTool } from "@journey/schemas";
import { z } from "zod";
import type { BuiltinToolContext, ToolFactory } from "./types";
import { defaultServiceRetryConfig } from "./types";
import { SYSTEM_TOOL_NAMES } from "../unified/tool-names";

// =============================================================================
// SEND MESSAGE TOOL
// =============================================================================

/**
 * Create send_message tool
 *
 * Sends messages to the user with optional buttons and media attachments.
 */
export const createSendMessageTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.SEND_MESSAGE,
    description: "Send a message to the user with optional buttons and media",
    schema: z
      .object({
        content: z.string().describe("Message content"),
        buttons: z
          .array(
            z.object({
              id: z.string(),
              text: z.string(),
              targetNodeId: z.string().optional(),
            })
          )
          .optional()
          .describe("Optional buttons"),
        media: z
          .object({
            type: z.enum(["image", "video"]),
            url: z.string().url(),
            filename: z.string().optional(),
          })
          .optional()
          .describe("Optional media attachment"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      actions: ["sendMessage"],
    },
    // Configurable timing - default immediate (tool message before main response)
    // UI can toggle to "Send after main response"
    timingConfig: {
      timing: "immediate",
      configurable: true,
    },
    execute: async ({ content, buttons, media }) => {
      try {
        // Build voice options if voice config is set (full voice config for TTS)
        const options = context.voiceMode
          ? {
              voice: {
                mode: context.voiceMode,
                profile: context.voiceProfile,
                provider: context.voiceProvider,
                elevenLabsModel: context.elevenLabsModel,
              },
            }
          : undefined;

        await context.services.messenger.sendMessage(
          content,
          buttons,
          media,
          undefined, // prebuiltContext - not needed for tool calls
          options
        );
        context.log.debug(
          { contentLength: content.length, buttonCount: buttons?.length || 0, voiceMode: context.voiceMode },
          "agent:tool:sendMessage"
        );
        return { success: true, message: "Message sent" };
      } catch (error) {
        context.log.error({ err: serializeError(error) }, "agent:tool:sendMessage:failed");
        return { error: "Failed to send message", message: String(error) };
      }
    },
  };
};

// =============================================================================
// EXIT TO NEXT NODE TOOL (Journey Routing)
// =============================================================================

/**
 * Create exit_to_next_node tool
 *
 * Signals that the agent conversation is complete and the journey should
 * transition to the next node. This is a Journey Routing tool - the actual
 * transition is handled by the journey engine's agent-handler.
 *
 * This tool has no retry config as it's a state signal, not a service call.
 */
export const createExitToNextNodeTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.EXIT_TO_NEXT_NODE,
    description: "Exit the current agent node and transition to the next node in the journey",
    schema: z
      .object({
        summary: z.string().optional().describe("Optional summary of the conversation"),
      })
      .loose(),
    // No retry - this is a state signal, not a service call
    capabilities: {
      actions: ["exitToNextNode"],
    },
    // Configurable timing - default deferred (send response first, then exit)
    // UI can toggle to "Exit before sending response"
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
    execute: async ({ summary }) => {
      // Note: This tool is just a signal to transition to the next node
      // The journey engine handles all message delivery via result.response
      // The summary is returned but NOT sent here - agent handler sends it
      context.log.info({ nodeId: context.nodeId, hasSummary: !!summary }, "agent:tool:exitToNextNode");
      return { success: true, exited: true, summary };
    },
  };
};

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Build messaging tools based on configuration
 *
 * @param context - Built-in tool context
 * @param config - Which tools to enable
 * @returns Array of enabled messaging tools
 */
export function buildMessagingTools(
  context: BuiltinToolContext,
  config: {
    sendMessage?: boolean;
    exitToNextNode?: boolean;
  }
): AgentTool[] {
  const tools: AgentTool[] = [];

  if (config.sendMessage) {
    tools.push(createSendMessageTool(context));
  }
  if (config.exitToNextNode) {
    tools.push(createExitToNextNodeTool(context));
  }

  return tools;
}
