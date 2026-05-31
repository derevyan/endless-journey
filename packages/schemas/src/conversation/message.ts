/**
 * Unified Conversation Message Schema
 *
 * Single source of truth for conversation messages across all packages:
 * - packages/engine (session state management)
 * - packages/llm (LLM operations and agent execution)
 * - packages/engine-integrations (database persistence)
 *
 * This schema is used by:
 * - Agent nodes for multi-turn conversations
 * - Workflow execution with conversation history
 * - LLM service for message formatting
 * - Database persistence in agent_conversations table
 */

import { z } from "zod";

/**
 * Tool call in assistant messages
 * Represents a tool/function call made by the assistant during LLM execution
 */
export const ToolCallSchema = z.object({
  id: z.string().describe("Unique tool call ID"),
  name: z.string().describe("Tool/function name"),
  args: z.record(z.string(), z.unknown()).describe("Arguments passed to the tool"),
  result: z.unknown().optional().describe("Result returned by the tool"),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

/**
 * Unified conversation message format
 *
 * Single source of truth for all conversation history in the system.
 * Used consistently across:
 * - In-memory session history (engine)
 * - Database storage (agent_conversations table)
 * - LLM API calls
 * - Workflow execution
 *
 * @example
 * ```typescript
 * // User message
 * {
 *   role: "user",
 *   content: "What's the status of my order?",
 *   timestamp: new Date("2026-01-04T12:00:00Z")
 * }
 *
 * // Assistant message with tool calls
 * {
 *   role: "assistant",
 *   content: "Let me check that for you...",
 *   timestamp: new Date("2026-01-04T12:00:01Z"),
 *   toolCalls: [
 *     {
 *       id: "call_123",
 *       name: "get_order_status",
 *       args: { order_id: "ORD-456" }
 *     }
 *   ]
 * }
 *
 * // Tool result message
 * {
 *   role: "tool",
 *   content: '{"status": "shipped", "tracking": "..."}',
 *   timestamp: new Date("2026-01-04T12:00:02Z"),
 *   toolCallId: "call_123"
 * }
 * ```
 */
export const ConversationMessageSchema = z.object({
  role: z
    .enum(["user", "assistant", "system", "tool"])
    .describe(
      "Message role: 'user' (user input), 'assistant' (AI response), 'system' (system message), 'tool' (tool result)"
    ),

  content: z
    .string()
    .describe("Message content/text. For tool messages, contains the tool result JSON or serialized result."),

  timestamp: z
    .coerce.date()
    .describe(
      "When the message was created. Timestamps help maintain conversation chronology and support conversation summarization."
    ),

  // Optional fields for tool-related messages
  toolCallId: z
    .string()
    .optional()
    .describe(
      "For 'tool' role messages, the ID of the tool call this result is for. Links tool results to their tool calls in multi-turn interactions."
    ),

  toolCalls: z
    .array(ToolCallSchema)
    .optional()
    .describe(
      "For 'assistant' role messages, tool calls made during LLM execution. Used for multi-turn tool conversations where assistant calls tools then processes results."
    ),

  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Optional platform-specific metadata (adapter type, debug info, etc.). Can be used for custom data without changing core schema."
    ),

  inputType: z
    .enum(["text", "voice"])
    .optional()
    .describe(
      "For 'user' role messages, how the message was sent: 'text' (typed) or 'voice' (transcribed from audio). Helps AI adapt responses for voice users."
    ),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
