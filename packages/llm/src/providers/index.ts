/**
 * LLM Providers
 *
 * Custom provider implementations for testing and development.
 * Audio providers for STT/TTS with multi-provider support.
 */

export {
  MockProvider,
  createMockWithResponse,
  createMockWithError,
  createMockWithHandlers,
  type MockProviderConfig,
} from "./mock";

// Audio provider exports
export {
  getSTTProvider,
  getTTSProvider,
  isProviderAvailable,
  getAvailableProviders,
} from "./audio-registry";

export type {
  AudioProvider,
  STTProvider,
  TTSProvider,
  STTProviderConfig,
  TTSProviderConfig,
  STTResult,
  AudioFormat,
  GetProviderOptions,
} from "./types";

export { getOpenAISTTProvider, getOpenAITTSProvider } from "./openai-audio";
