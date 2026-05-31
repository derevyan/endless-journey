# LLM Services

Comprehensive documentation for services in the `@journey/llm` package.

## Service Overview

| Service | Entry Point | Purpose |
| --- | --- | --- |
| LLM Service | `generateChatResponse`, `generateStructuredOutput` | Chat and structured output |
| Agent Engine | `runAgent` | Unified agent runtime with tools and middleware |
| Audio Service | `transcribeAudio`, `generateSpeech*` | STT and TTS (OpenAI) |
| Embedding Service | `generateEmbedding`, `generateEmbeddings` | Vector embeddings (OpenAI) |
| Guard Service | `evaluateGuards` | Content safety checks |
| Usage Tracking | `usageTrackingService` | DB-backed usage tracking + adapters |
| Question Understanding | `executeQuestionUnderstanding` | Map-reduce synthesis |
| Model Registry | `modelRegistryService` | Model metadata and pricing |

---

## LLM Service

Core service for chat completions and structured output generation.

### Public API

| Function | Description |
| --- | --- |
| `generateChatResponse()` | Chat completion (non-streaming) |
| `generateStructuredOutput()` | Zod-validated structured output |
| `generateChatResponseStream()` | Streaming chat with callbacks |
| `generateChatResponseIterator()` | Streaming chat with async iterator |
| `clearModelCache()` | Clear model instance cache |

### Configuration

```typescript
interface LLMConfig {
  // Model selection
  model: string;
  provider?: "openai" | "anthropic" | "google-genai" | "groq";
  fallbackModels?: string[]; // Auto-detects provider per model

  // Sampling parameters
  temperature?: number; // 0-2
  topP?: number; // 0-1 (nucleus sampling)
  frequencyPenalty?: number; // -2 to 2
  presencePenalty?: number; // -2 to 2

  // Generation control
  maxTokens?: number;
  reasoningEffort?: "low" | "medium" | "high"; // Overrides temperature for reasoning models

  // Runtime control
  timeout?: number; // seconds (converted to ms internally)
  maxRetries?: number;

  // Structured output
  structuredOutputMethod?: "jsonSchema" | "functionCalling";

  // Cost attribution
  organizationId?: string;
}

interface LLMResponse<T> {
  result: T;
  tokenUsage?: TokenUsage;
  modelUsed?: string; // Actual model used (important for fallback chains)
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
```

Notes:
- **Provider Resolution**: Follows a 3-tier process: explicit config → model registry lookup → prefix detection.
- **Cross-Provider Fallback**: When using `fallbackModels`, provider is auto-detected per model, enabling fallback chains like OpenAI → Anthropic → Google.
- **Sampling Parameters**: `topP`, `frequencyPenalty`, and `presencePenalty` provide fine-grained control over output diversity and repetition.
- **Timeout**: Specified in seconds and converted to milliseconds internally for LangChain.
- **Reasoning Effort**: Overrides `temperature` for O1/O3 reasoning models.
- **Structured Output**: Defaults to `jsonSchema` for OpenAI and `functionCalling` for others.
- **Organization ID**: Optional field for cost attribution in multi-tenant scenarios.
- **Empty System Prompt**: Skips the system message (required for text-classification models).

### Chat Completion

```typescript
import { createLogger } from "@journey/logger";
import { generateChatResponse } from "@journey/llm";

const log = createLogger("llm:services");

const response = await generateChatResponse(
  "You are a helpful assistant specialized in TypeScript.",
  [{ role: "user", content: "Explain generics in TypeScript" }],
  { model: "gpt-4o", temperature: 0.7, maxTokens: 1000 }
);

log.info({ tokens: response.tokenUsage?.totalTokens }, "llm:chat:done");
```

### Structured Output

```typescript
import { generateStructuredOutput } from "@journey/llm";
import { z } from "zod";

const UserProfileSchema = z.object({
  name: z.string(),
  age: z.number().min(0).max(150),
  email: z.string().email().optional(),
  interests: z.array(z.string()),
});

const response = await generateStructuredOutput(
  "Extract user information from the text.",
  "John Doe, 28 years old, enjoys hiking and photography.",
  UserProfileSchema,
  { model: "gpt-4o" }
);
```

Notes:
- `google-genai` schemas are sanitized; dynamic keys (record/map/set) and passthrough objects are rejected.
- `fallbackModels` applies to `generateChatResponse` and `generateStructuredOutput` (not streaming).

---

## Agent Engine (`runAgent`)

`runAgent()` is the unified agent runtime. It supports tool execution, structured output, and middleware composition.

### Configuration

```typescript
interface AgentEngineConfig extends LLMConfig {
  tools?: AgentTool[];
  maxIterations?: number;
  middleware?: AgentMiddleware[];
  responseFormat?: {
    type: "text" | "json_schema"; // Only json_schema for strict validation
    name?: string;
    schema?: Record<string, unknown>;
    strict?: boolean;
    method?: "jsonSchema" | "functionCalling";
  };
  parallelToolExecution?: boolean; // default: true
  runtime?: AgentRuntime;
}
```

Notes:
- `responseFormat.type: "json_schema"` is the only structured mode with strict validation and schema enforcement.
- Tool schemas are Zod; non-Zod schemas skip validation (common for MCP tools).
- Tool calls support per-tool retries via `ToolRetryConfig`.
- `parallelToolExecution` defaults to true; disable for sequential tool runs.
- For structured output with tools, `runAgent` injects a `__final_response__` tool.
- Middleware is passed as an array and composed internally.

### Result Type

```typescript
interface AgentEngineResult {
  content: string;
  structuredResponse?: Record<string, unknown>;
  toolCalls?: Array<{ id: string; name: string; args: unknown; result?: unknown }>;
  iterations: number;
  usage?: TokenUsage;
  modelUsed?: string;
  finalState?: AgentState;
}
```

### Basic Agent

```typescript
import { runAgent } from "@journey/llm";
import { z } from "zod";

const tools = [
  {
    name: "search_web",
    description: "Search the web for information",
    schema: z.object({ query: z.string() }),
    execute: async ({ query }) => ({ results: [`Result for ${query}`] }),
  },
];

const result = await runAgent(
  "You are a helpful assistant.",
  [{ role: "user", content: "Find docs for React 19." }],
  { model: "gpt-4o", tools, maxIterations: 5 }
);
```

---

## Agent with Middleware

```typescript
import {
  runAgent,
  createModelFallbackMiddleware,
  createModelCallLimitMiddleware,
  createPIIMiddleware,
} from "@journey/llm";

const result = await runAgent(
  "You are a helpful assistant.",
  [{ role: "user", content: "Email me at demo@example.com" }],
  {
    model: "gpt-4o",
    tools: [],
    middleware: [
      createModelFallbackMiddleware("gpt-4o-mini"),
      createModelCallLimitMiddleware({ runLimit: 10 }),
      createPIIMiddleware("email", { strategy: "redact" }),
    ],
    runtime: { orgId: "org_123", sessionId: "sess_123" },
  }
);
```

Notes:
- Middleware is passed as an array to `runAgent` and composed internally.
- Runtime context (`orgId`, `sessionId`, `nodeId`) is available to middleware hooks.

---

## Audio Service (OpenAI)

Speech-to-text and text-to-speech using OpenAI APIs.

### Speech-to-Text

```typescript
import { transcribeAudio } from "@journey/llm";

const result = await transcribeAudio(audioBuffer, "recording.webm");
const transcript = result.transcript;
```

### Text-to-Speech

```typescript
import { generateSpeech } from "@journey/llm";

const audio = await generateSpeech("Hello, world!", { voice: "ash" });
```

Defaults:
- STT model: `gpt-4o-transcribe`
- Streaming TTS model: `gpt-4o-audio-preview`
- Non-streaming TTS model: `gpt-4o-mini-tts`

### Streaming TTS

```typescript
import { generateSpeechStream } from "@journey/llm";

await generateSpeechStream(
  "This will stream audio chunks.",
  { voice: "coral", format: "pcm16" },
  {
    onAudioChunk: (chunk) => void chunk,
    onComplete: (totalChunks) => void totalChunks,
    onError: (error) => { throw error; },
  }
);
```

Notes:
- `OPENAI_API_KEY` is required.
- Pass `organizationId` in `STTConfig`/`TTSConfig` to enable usage tracking.

---

## Embedding Service (OpenAI)

```typescript
import { generateEmbedding, generateEmbeddings } from "@journey/llm";

const single = await generateEmbedding("Sample text");
const batch = await generateEmbeddings(["Doc 1", "Doc 2"]);
```

`generateEmbedding()` returns `{ embedding, tokenCount }`.
Defaults: `text-embedding-3-small` with `dimensions: 1536`. Batch calls do not return per-item token counts.

---

## Guard Service

Parallel guard evaluation for safety checks.

```typescript
import { evaluateGuards } from "@journey/llm";

const result = await evaluateGuards({
  content: "User message",
  conversationContext: "Prior messages...",
});

if (!result.allowed) {
  // Blocked
}
```

Notes:
- Defaults come from `llmConfig.guards` in `@journey/schemas`.
- Guards run in parallel and use "any blocks" strategy.
- Worker errors and timeouts fail-open to avoid blocking on guard failures.

---

## Usage Tracking Service

DB-backed usage tracking with buffering. Use only in server runtimes.

```typescript
import { usageTrackingService, LoggingUsageAdapter } from "@journey/llm";

usageTrackingService.initialize();
usageTrackingService.setAdapter(new LoggingUsageAdapter());
usageTrackingService.recordUsage(
  { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  { organizationId: "org_123", service: "agent-handler", model: "gpt-4o" }
);

await usageTrackingService.shutdown();
```

Notes:
- `organizationId` is required; events without it are skipped.
- `recordUsage()` is non-blocking and buffers writes.

---

## Question Understanding Service

Map-reduce pattern for synthesizing answers using multiple workers and an evaluator.

```typescript
import { executeQuestionUnderstanding } from "@journey/llm";

const result = await executeQuestionUnderstanding(
  "What courses do you offer?",
  {
    workers: [
      { id: "w1", model: "gpt-4o-mini", provider: "openai" },
      { id: "w2", model: "claude-haiku-4-5", provider: "anthropic" },
    ],
    evaluator: {
      model: "claude-haiku-4-5",
      temperature: 0.1,
      timeoutMs: 30000,
      backupModels: ["gemini-2.5-pro"],
    },
    workersTemperature: 0.2,
    workerTimeoutMs: 6000,
    maxWorkersThreads: 6,
    requireAllWorkers: false,
    fallback: { enabled: true, strategy: "first_worker" },
    includeReasoningInOutput: true,
  },
  { conversationHistory: "User: Hello\nAI: Hi there!", organizationId: "org_123" }
);
```

Notes:
- Config shape is defined in `QuestionUnderstandingConfig` from `@journey/schemas`.
- Usage is tracked when `organizationId` is provided.

---

## Error Handling

All services throw typed errors for provider failures:

```typescript
import { LLMError, LLMAuthError, LLMRateLimitError, LLMTimeoutError } from "@journey/llm";

try {
  await generateChatResponse(systemPrompt, messages, config);
} catch (error) {
  if (error instanceof LLMAuthError) {
    // Invalid API key
  } else if (error instanceof LLMRateLimitError) {
    // Retry after error.retryAfterMs
  } else if (error instanceof LLMTimeoutError) {
    // Timeout
  } else if (error instanceof LLMError) {
    // Generic LLM error
  }
}
```

Provider-aware classification:

```typescript
import { classifyError, isRetryableError } from "@journey/llm";

const classification = classifyError(error);
if (classification.retryable || isRetryableError(error)) {
  // Backoff + retry
}
```

---

## Service Comparison

| Feature | LLM Service | Agent Engine (`runAgent`) | Audio Service | Embedding Service |
| --- | --- | --- | --- | --- |
| Primary Use | Chat + structured output | Tool-calling agent with middleware | STT/TTS | Vector search |
| Streaming | Yes (stream + iterator) | No | Yes (TTS) | No |
| Structured Output | Yes | Yes (`json_schema`) | No | No |
| Token Tracking | Yes | Yes | Optional (orgId) | Optional (orgId) |
| Middleware | No | Yes (array) | No | No |
