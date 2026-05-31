import type { PromptChatMessage, PromptType } from "@journey/schemas";

import { isRecord, isString, isStringArray } from "../../../lib/type-guards";

export function normalizeStringArray(value: unknown): string[] {
  return isStringArray(value) ? value : [];
}

function isPromptChatMessage(value: unknown): value is PromptChatMessage {
  if (!isRecord(value)) return false;
  const role = value.role;
  if (role !== "system" && role !== "user" && role !== "assistant") return false;
  return isString(value.content);
}

function parsePromptChatMessages(value: unknown): PromptChatMessage[] | null {
  if (!Array.isArray(value)) return null;
  const messages: PromptChatMessage[] = [];
  for (const item of value) {
    if (!isPromptChatMessage(item)) return null;
    messages.push(item);
  }
  return messages;
}

export function resolvePromptContent(
  type: PromptType,
  content: unknown
): { text?: string; chat?: PromptChatMessage[] } | null {
  if (type === "text") {
    return isString(content) ? { text: content } : null;
  }

  const chatMessages = parsePromptChatMessages(content);
  return chatMessages ? { chat: chatMessages } : null;
}
