import type { z } from "zod";
import { createLogger } from "@journey/logger";
import type { LLMConfig, LLMResponse, ChatMessage, TokenUsage, StreamCallbacks } from "../services/llm-service";
import { LLMError } from "../types";

const log = createLogger("llm:mock");

/**
 * Configuration for mock provider
 */
export interface MockProviderConfig {
  /** Default response for chat completion */
  response?: string;
  /** Default response for structured output (will be validated against schema) */
  structuredResponse?: unknown;
  /** Custom handler for chat messages */
  chatHandler?: (systemPrompt: string, messages: ChatMessage[]) => Promise<string>;
  /** Custom handler for structured output */
  structuredHandler?: <T>(systemPrompt: string, userContent: string, schema: z.ZodType<T>) => Promise<T>;
  /** Simulated delay in milliseconds */
  delay?: number;
  /** Delay between tokens in streaming mode (default: 10ms) */
  streamDelay?: number;
  /** Throw this error instead of returning a response */
  error?: Error;
}

/**
 * Mock LLM provider for testing and development
 */
export class MockProvider {
  private config: MockProviderConfig;

  constructor(config: MockProviderConfig = {}) {
    this.config = config;
  }

  async generateStructuredOutput<T>(
    systemPrompt: string,
    userContent: string,
    schema: z.ZodType<T>,
    _config?: LLMConfig
  ): Promise<LLMResponse<T>> {
    log.debug({ mock: true }, "mock:structuredRequest");

    // Simulate processing delay
    if (this.config.delay) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delay));
    }

    // Throw configured error
    if (this.config.error) {
      throw this.config.error;
    }

    // Use custom handler if provided
    if (this.config.structuredHandler) {
      const result = await this.config.structuredHandler(systemPrompt, userContent, schema);
      return {
        result,
        tokenUsage: mockTokenUsage(),
      };
    }

    // Use configured structured response
    if (this.config.structuredResponse !== undefined) {
      const parsed = schema.parse(this.config.structuredResponse);
      return {
        result: parsed,
        tokenUsage: mockTokenUsage(),
      };
    }

    // Default: return empty object parsed through schema
    // This will fail for most schemas - tests should configure structuredResponse
    throw new Error("Mock provider: structuredResponse not configured");
  }

  async generateChatResponse(
    systemPrompt: string,
    messages: ChatMessage[],
    _config?: LLMConfig
  ): Promise<LLMResponse<string>> {
    log.debug({ mock: true, messageCount: messages.length }, "mock:chatRequest");

    // Simulate processing delay (default 100ms)
    const delay = this.config.delay ?? 100;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Throw configured error
    if (this.config.error) {
      throw this.config.error;
    }

    // Use custom handler if provided
    if (this.config.chatHandler) {
      const result = await this.config.chatHandler(systemPrompt, messages);
      return {
        result,
        tokenUsage: mockTokenUsage(),
      };
    }

    // Use configured response
    const response = this.config.response ?? `Mock response to: "${messages[messages.length - 1]?.content ?? "your message"}"`;

    log.info({ mock: true }, "mock:chatResponse");

    return {
      result: response,
      tokenUsage: mockTokenUsage(),
    };
  }

  /**
   * Generate chat response with streaming using callbacks
   */
  async generateChatResponseStream(
    systemPrompt: string,
    messages: ChatMessage[],
    _config: LLMConfig | undefined,
    callbacks: StreamCallbacks
  ): Promise<void> {
    log.debug({ mock: true, messageCount: messages.length }, "mock:streamRequest");

    // Simulate processing delay
    if (this.config.delay) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delay));
    }

    // Throw configured error
    if (this.config.error) {
      const wrappedError = new LLMError(this.config.error.message, "mock", "MOCK_ERROR", this.config.error);
      callbacks.onError?.(wrappedError);
      if (!callbacks.onError) {
        throw wrappedError;
      }
      return;
    }

    // Get response text
    const response = this.config.chatHandler
      ? await this.config.chatHandler(systemPrompt, messages)
      : this.config.response ?? `Mock response to: "${messages[messages.length - 1]?.content ?? "your message"}"`;

    // Stream tokens one by one
    const tokens = response.split(" ");
    const streamDelay = this.config.streamDelay ?? 10;

    for (const token of tokens) {
      await new Promise((resolve) => setTimeout(resolve, streamDelay));
      callbacks.onToken?.(token + " ");
    }

    log.info({ mock: true }, "mock:streamResponse");
    callbacks.onComplete?.(response, mockTokenUsage());
  }

  /**
   * Generate chat response with streaming using async iterator
   */
  async *generateChatResponseIterator(
    systemPrompt: string,
    messages: ChatMessage[],
    _config?: LLMConfig
  ): AsyncGenerator<string, LLMResponse<string>, unknown> {
    log.debug({ mock: true, messageCount: messages.length }, "mock:iteratorRequest");

    // Simulate processing delay
    if (this.config.delay) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delay));
    }

    // Throw configured error
    if (this.config.error) {
      throw new LLMError(this.config.error.message, "mock", "MOCK_ERROR", this.config.error);
    }

    // Get response text
    const response = this.config.chatHandler
      ? await this.config.chatHandler(systemPrompt, messages)
      : this.config.response ?? `Mock response to: "${messages[messages.length - 1]?.content ?? "your message"}"`;

    // Stream tokens one by one
    const tokens = response.split(" ");
    const streamDelay = this.config.streamDelay ?? 10;

    for (const token of tokens) {
      await new Promise((resolve) => setTimeout(resolve, streamDelay));
      yield token + " ";
    }

    log.info({ mock: true }, "mock:iteratorResponse");

    return {
      result: response,
      tokenUsage: mockTokenUsage(),
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function mockTokenUsage(): TokenUsage {
  return {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a mock provider with a specific response
 */
export function createMockWithResponse(response: string): MockProvider {
  return new MockProvider({ response });
}

/**
 * Create a mock provider that throws an error
 */
export function createMockWithError(message: string): MockProvider {
  return new MockProvider({ error: new Error(message) });
}

/**
 * Create a mock provider with custom handlers
 */
export function createMockWithHandlers(handlers: {
  chat?: (systemPrompt: string, messages: ChatMessage[]) => Promise<string>;
  structured?: <T>(systemPrompt: string, userContent: string, schema: z.ZodType<T>) => Promise<T>;
}): MockProvider {
  return new MockProvider({
    chatHandler: handlers.chat,
    structuredHandler: handlers.structured,
  });
}
