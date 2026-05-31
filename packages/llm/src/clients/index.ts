/**
 * LLM Clients
 *
 * Shared client singletons for external LLM providers.
 */

export { getOpenAIClient, clearOpenAIClient } from "./openai";

export {
  getElevenLabsApiKey,
  getElevenLabsHeaders,
  getElevenLabsFormHeaders,
  clearElevenLabsApiKey,
  isElevenLabsConfigured,
  mapToElevenLabsFormat,
  ELEVENLABS_BASE_URL,
} from "./elevenlabs";
