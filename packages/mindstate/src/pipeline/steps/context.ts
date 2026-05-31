import type { Message, ContextOutput } from "../../types";

/**
 * Context step - prepares conversation context from recent messages
 */
export function prepareContext(messages: Message[], limit: number = 20): ContextOutput {
  const recentMessages = messages.slice(-limit);
  const conversationContext = recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n");

  return { conversationContext, recentMessages };
}
