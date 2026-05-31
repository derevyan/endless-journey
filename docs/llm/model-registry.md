# Model Registry

Centralized model metadata service backed by `essential-models.ts`.

## Overview

- Loads model data from pre-compiled `packages/schemas/src/llm/essential-models.ts`
- Supports providers (openai, anthropic, google-genai, groq, cerebras)
- Provides pricing and capability metadata
- Call `modelRegistryService.initialize()` once at startup to populate the cache

## ModelMetadata

```typescript
interface ModelMetadata {
  id: string;
  displayName: string;
  description: string;
  provider: "openai" | "anthropic" | "google-genai" | "groq" | "cerebras";
  supportsTemperature: boolean;
  temperatureRange?: { min: number; max: number };
  capabilities: {
    reasoning: boolean;
    vision: boolean;
    toolCalling: boolean;
  };
  contextWindow: number;
  outputLimit: number;
  pricing: {
    input: number; // per 1M tokens
    output: number; // per 1M tokens
    cacheRead?: number;
    cacheWrite?: number;
    reasoning?: number;
  };
  releaseDate?: string;
  knowledge?: string;
}
```

## Registry API

```typescript
import { modelRegistryService } from "@journey/llm";

await modelRegistryService.initialize();

const models = modelRegistryService.getModels();
const grouped = modelRegistryService.getModelsByProvider();
const model = modelRegistryService.getModel("gpt-4o");
const cost = modelRegistryService.calculateCost("gpt-4o", 1000, 500);

// Provider is looked up from model registry - no need for manual detection
const modelInfo = modelRegistryService.getModel("claude-3-5-sonnet");
const provider = modelInfo?.provider; // "anthropic"
```

### getModels()

Returns all filtered and normalized models.

### getModelsByProvider()

Returns a record keyed by provider (`openai`, `anthropic`, `google-genai`, `groq`).

### getModel(modelId)

Returns a single model or undefined.

### initialize()

Loads essential-models.ts, validates with Zod, and caches models in memory.

### calculateCost(modelId, inputTokens, outputTokens)

Uses pricing data to compute cost in USD. Supports fuzzy matching of model IDs.
Returns `0` (and logs a warning) if the model is not found or registry is not initialized.

### getLastLoadTime()

Returns the timestamp of the last successful load.

### clear()

Clears registry cache (useful in tests).

## Supported Providers

| JSON Provider | LangChain ID |
| --- | --- |
| OpenAI | `openai` |
| Anthropic | `anthropic` |
| Google | `google-genai` |
| Groq | `groq` |
| Cerebras | `cerebras` |

## Cost Calculation

```typescript
const inputCost = (promptTokens / 1_000_000) * model.pricing.input;
const outputCost = (completionTokens / 1_000_000) * model.pricing.output;
const totalCost = inputCost + outputCost;
```

## Provider Resolution

Provider is determined by looking up the model in the registry. The registry is the single source of truth for model→provider mapping.

For models not in the registry, pass the provider explicitly:

```typescript
const result = await generateChatResponse(
  "You are helpful.",
  [{ role: "user", content: "Hello" }],
  { model: "custom-model", provider: "openai" }
);
```
