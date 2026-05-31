import type { MainAgent, StateParameter, TokenUsage } from "@journey/schemas";
import type { Message, ResponseOutput } from "../../types";
import { generateMainAgentResponse } from "../../llm/agent-service";
import { generateMessageId } from "../../utils/id";

/**
 * Extended response output including token usage
 */
export interface ResponseOutputWithUsage extends ResponseOutput {
  tokenUsage?: TokenUsage;
  error?: Error;
}

/**
 * Response step - generates main agent response
 */
export async function generateResponse(
  messages: Message[],
  userMessage: Message,
  updatedState: StateParameter[],
  mainAgent: MainAgent
): Promise<ResponseOutputWithUsage> {
  const allMessages = [...messages, userMessage];
  const result = await generateMainAgentResponse(allMessages, updatedState, mainAgent);

  const assistantMessage: Message = {
    id: generateMessageId(),
    role: "assistant",
    content: result.response,
    timestampMs: Date.now(),
  };

  return {
    response: result.response,
    assistantMessage,
    tokenUsage: result.tokenUsage,
    error: result.error,
  };
}
