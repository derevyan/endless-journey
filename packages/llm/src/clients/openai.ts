/**
 * Shared OpenAI Client
 *
 * Provides a singleton OpenAI client instance for use across the LLM package.
 * This eliminates duplicate client initialization in audio-service and embedding-service.
 */

import OpenAI from "openai";
import { LLMAuthError } from "../types";

let openaiClient: OpenAI | null = null;

/**
 * Get or create the shared OpenAI client
 *
 * @throws LLMAuthError if OPENAI_API_KEY is not set
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new LLMAuthError(
        "openai",
        new Error("OPENAI_API_KEY environment variable is not set")
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Clear the cached OpenAI client
 *
 * Useful for testing or when API keys change at runtime.
 */
export function clearOpenAIClient(): void {
  openaiClient = null;
}
