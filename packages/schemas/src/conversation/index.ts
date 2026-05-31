/**
 * Conversation Schema Module
 *
 * Exports unified conversation message types used across all packages.
 * This is the single source of truth for conversation history structure.
 */

export type { ConversationMessage, ToolCall } from "./message";
export { ConversationMessageSchema, ToolCallSchema } from "./message";
