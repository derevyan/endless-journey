import type { Message, IngestOutput } from "../../types";
import { generateMessageId } from "../../utils/id";

/**
 * Ingest step - creates a user message object
 */
export function ingestMessage(userMessage: string): IngestOutput {
  const message: Message = {
    id: generateMessageId(),
    role: "user",
    content: userMessage,
    timestampMs: Date.now(),
  };
  return { message };
}
