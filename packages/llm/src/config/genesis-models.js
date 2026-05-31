import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join("/tmp", "llm-models.json");
const outputPath = path.join(__dirname, "../../../schemas/src/llm/essential-models.ts");

// Fetch fresh model data from models.dev
console.log("Fetching latest model data from models.dev...");
try {
  const response = await fetch("https://models.dev/api.json");
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
  }
  const freshData = await response.json();

  // Save fresh data to llm-models.json
  fs.writeFileSync(inputPath, JSON.stringify(freshData, null, 2));
  console.log("✓ Updated llm-models.json with latest data from models.dev");
} catch (error) {
  console.warn("⚠ Failed to fetch fresh data from models.dev, using existing llm-models.json");
  console.warn(`  Error: ${error.message}`);
}

const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const allowedProviders = ["groq", "google", "openai", "anthropic"];
const minDate = "2025-08-01";

const whitelistedIds = [
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-5-20251101",
  "claude-haiku-4-5-20251001",
  "gpt-5.2",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1-mini",
  "gpt-4o-mini",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "moonshotai/kimi-k2-instruct-0905",
  "qwen/qwen3-32b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "whisper-large-v3",
  "whisper-large-v3-turbo",
  "meta-llama/llama-guard-4-12b",
  "openai/gpt-oss-safeguard-20b",
  "meta-llama/llama-prompt-guard-2-86m",
  // Audio models (TTS/STT)
  "tts-1",
  "tts-1-hd",
  "gpt-4o-mini-tts",
  "gpt-4o-transcribe",
];

const essentialModels = [];
const filteredJson = {};

for (const [providerId, providerData] of Object.entries(data)) {
  if (!allowedProviders.includes(providerId)) continue;

  const filteredModels = {};
  for (const [modelId, model] of Object.entries(providerData.models)) {
    const isWhitelisted = whitelistedIds.includes(modelId);
    const isNewEnough = model.release_date && model.release_date >= minDate;

    if (!isWhitelisted && !isNewEnough) continue;

    // Skip codex models - they require special Responses API handling
    if (modelId.includes("codex")) continue;

    filteredModels[modelId] = model;

    // gemini-3-flash-preview is a reasoning model that should use reasoningEffort instead of temperature
    // Google recommends not using temperature with this model
    const isGeminiFlashReasoning = modelId === "gemini-3-flash-preview";

    essentialModels.push({
      id: model.id,
      displayName: model.name,
      provider: providerId === "google" ? "google-genai" : providerId,
      category: "llm", // All models from models.dev are LLM models
      supportsTemperature: isGeminiFlashReasoning ? false : !!model.temperature,
      capabilities: {
        reasoning: !!model.reasoning,
        vision: !!model.attachment,
        toolCalling: !!model.tool_call,
      },
      pricing: {
        input: model.cost?.input || 0,
        output: model.cost?.output || 0,
        cacheRead: model.cost?.cache_read,
        cacheWrite: model.cost?.cache_write,
      },
      contextWindow: model.limit?.context || 0,
      outputLimit: model.limit?.output || 0,
    });
  }

  if (Object.keys(filteredModels).length > 0) {
    filteredJson[providerId] = {
      ...providerData,
      models: filteredModels,
    };
  }
}

// =============================================================================
// Audio Models (TTS/STT) - manually defined since models.dev doesn't have them
// =============================================================================
const audioModels = [
  {
    id: "tts-1",
    displayName: "TTS-1 (Standard)",
    provider: "openai",
    category: "audio",
    supportsTemperature: false,
    capabilities: { reasoning: false, vision: false, toolCalling: false },
    pricing: { input: 0, output: 0, perCharacter: 0.000015 }, // $15/1M chars
    contextWindow: 0,
    outputLimit: 0,
  },
  {
    id: "tts-1-hd",
    displayName: "TTS-1 HD (High Definition)",
    provider: "openai",
    category: "audio",
    supportsTemperature: false,
    capabilities: { reasoning: false, vision: false, toolCalling: false },
    pricing: { input: 0, output: 0, perCharacter: 0.00003 }, // $30/1M chars
    contextWindow: 0,
    outputLimit: 0,
  },
  {
    id: "gpt-4o-mini-tts",
    displayName: "GPT-4o Mini TTS",
    provider: "openai",
    category: "audio",
    supportsTemperature: false,
    capabilities: { reasoning: false, vision: false, toolCalling: false },
    pricing: { input: 0, output: 0, perCharacter: 0.000015 }, // Simplified from hybrid pricing
    contextWindow: 0,
    outputLimit: 0,
  },
  {
    id: "gpt-4o-transcribe",
    displayName: "GPT-4o Transcribe",
    provider: "openai",
    category: "audio",
    supportsTemperature: false,
    capabilities: { reasoning: false, vision: false, toolCalling: false },
    pricing: { input: 0, output: 0, perSecond: 0.0001 }, // $0.006/min = $0.0001/sec
    contextWindow: 0,
    outputLimit: 0,
  },
  // ElevenLabs TTS Models
  // Pricing: Starter tier = 30k chars @ $5/mo = $0.000167/char
  // See: https://elevenlabs.io/pricing/api
  {
    id: "eleven_flash_v2_5",
    displayName: "ElevenLabs Flash v2.5",
    provider: "elevenlabs",
    category: "audio",
    supportsTemperature: false,
    capabilities: { reasoning: false, vision: false, toolCalling: false },
    pricing: { input: 0, output: 0, perCharacter: 0.000167 },
    contextWindow: 0,
    outputLimit: 0,
    audio: {
      label: "Flash v2.5 (Streaming)",
      description: "Ultra-low latency streaming (~75ms)",
      languages: 29,
      experimental: false,
      type: "tts",
    },
  },
  {
    id: "eleven_multilingual_v2",
    displayName: "ElevenLabs Multilingual v2",
    provider: "elevenlabs",
    category: "audio",
    supportsTemperature: false,
    capabilities: { reasoning: false, vision: false, toolCalling: false },
    pricing: { input: 0, output: 0, perCharacter: 0.000167 },
    contextWindow: 0,
    outputLimit: 0,
    audio: {
      label: "Multilingual v2 (Stable)",
      description: "Most lifelike model with rich emotional expression",
      languages: 29,
      experimental: false,
      type: "tts",
    },
  },
  {
    id: "eleven_v3",
    displayName: "ElevenLabs v3",
    provider: "elevenlabs",
    category: "audio",
    supportsTemperature: false,
    capabilities: { reasoning: false, vision: false, toolCalling: false },
    pricing: { input: 0, output: 0, perCharacter: 0.000167 },
    contextWindow: 0,
    outputLimit: 0,
    audio: {
      label: "v3 (Experimental)",
      description: "Human-like and expressive speech generation",
      languages: 70,
      experimental: true,
      type: "tts",
    },
  },
  {
    id: "eleven_turbo_v2_5",
    displayName: "ElevenLabs Turbo v2.5",
    provider: "elevenlabs",
    category: "audio",
    supportsTemperature: false,
    capabilities: { reasoning: false, vision: false, toolCalling: false },
    pricing: { input: 0, output: 0, perCharacter: 0.000167 },
    contextWindow: 0,
    outputLimit: 0,
    audio: {
      label: "Turbo v2.5",
      description: "Fast generation with good quality",
      languages: 29,
      experimental: false,
      type: "tts",
    },
  },
  // ElevenLabs STT Model
  {
    id: "scribe_v1",
    displayName: "ElevenLabs Scribe v1",
    provider: "elevenlabs",
    category: "audio",
    supportsTemperature: false,
    capabilities: { reasoning: false, vision: false, toolCalling: false },
    pricing: { input: 0, output: 0, perSecond: 0.000167 },
    contextWindow: 0,
    outputLimit: 0,
    audio: {
      label: "Scribe v1",
      description: "Speech recognition with 99 language support",
      languages: 99,
      experimental: false,
      type: "stt",
    },
  },
];
essentialModels.push(...audioModels);

// =============================================================================
// Cerebras Models - Ultra-fast inference via specialized AI processors
// Not in models.dev, so manually defined
// =============================================================================
const cerebrasModels = [
  {
    id: "llama3.1-8b",
    displayName: "Llama 3.1 8B (Cerebras)",
    provider: "cerebras",
    category: "llm",
    supportsTemperature: true,
    capabilities: { reasoning: false, vision: false, toolCalling: true },
    pricing: { input: 0.10, output: 0.10 },
    contextWindow: 131072,
    outputLimit: 8192,
  },
  {
    id: "llama-3.3-70b",
    displayName: "Llama 3.3 70B (Cerebras)",
    provider: "cerebras",
    category: "llm",
    supportsTemperature: true,
    capabilities: { reasoning: false, vision: false, toolCalling: true },
    pricing: { input: 0.85, output: 1.20 },
    contextWindow: 131072,
    outputLimit: 8192,
  },
  {
    id: "gpt-oss-120b",
    displayName: "GPT OSS 120B (Cerebras)",
    provider: "cerebras",
    category: "llm",
    supportsTemperature: true,
    capabilities: { reasoning: true, vision: false, toolCalling: true },
    pricing: { input: 0.35, output: 0.75 },
    contextWindow: 131072,
    outputLimit: 65536,
  },
  {
    id: "qwen-3-32b",
    displayName: "Qwen 3 32B (Cerebras)",
    provider: "cerebras",
    category: "llm",
    supportsTemperature: true,
    capabilities: { reasoning: true, vision: false, toolCalling: true },
    pricing: { input: 0.40, output: 0.80 },
    contextWindow: 131072,
    outputLimit: 8192,
  },
  {
    id: "zai-glm-4.7",
    displayName: "Z.ai GLM 4.7 (Cerebras)",
    provider: "cerebras",
    category: "llm",
    supportsTemperature: true,
    capabilities: { reasoning: true, vision: false, toolCalling: true },
    pricing: { input: 0.50, output: 1.00 },
    contextWindow: 131072,
    outputLimit: 8192,
  },
  {
    id: "qwen-3-235b-a22b-instruct-2507",
    displayName: "Qwen 3 235B Instruct (Cerebras)",
    provider: "cerebras",
    category: "llm",
    supportsTemperature: true,
    capabilities: { reasoning: true, vision: false, toolCalling: true },
    pricing: { input: 1.00, output: 2.00 },
    contextWindow: 131072,
    outputLimit: 8192,
  },
];
essentialModels.push(...cerebrasModels);

// =============================================================================
// Generate ElevenLabs TTS/STT model objects for UI consumption
// =============================================================================
const elevenLabsTtsModels = audioModels
  .filter((m) => m.provider === "elevenlabs" && m.audio?.type === "tts")
  .reduce((acc, m) => {
    // Convert id to key: "eleven_multilingual_v2" → "multilingual_v2", "eleven_v3" → "v3"
    const key = m.id.replace(/^eleven_/, "");
    acc[key] = {
      id: m.id,
      label: m.audio.label,
      description: m.audio.description,
      languages: m.audio.languages,
      experimental: m.audio.experimental,
    };
    return acc;
  }, {});

const elevenLabsSttModels = audioModels
  .filter((m) => m.provider === "elevenlabs" && m.audio?.type === "stt")
  .reduce((acc, m) => {
    // Keep id as key for STT models
    const key = m.id;
    acc[key] = {
      id: m.id,
      label: m.audio.label,
      description: m.audio.description,
      languages: m.audio.languages,
      experimental: m.audio.experimental,
    };
    return acc;
  }, {});

const tsContent =
  "/**\n" +
  " * ╔══════════════════════════════════════════════════════════════════════════╗\n" +
  " * ║  ⚠️  WARNING: AUTO-GENERATED FILE - DO NOT EDIT MANUALLY! ⚠️              ║\n" +
  " * ╠══════════════════════════════════════════════════════════════════════════╣\n" +
  " * ║                                                                          ║\n" +
  " * ║  This file is generated by: packages/llm/src/config/genesis-models.js    ║\n" +
  " * ║                                                                          ║\n" +
  " * ║  To update model pricing or add new models:                              ║\n" +
  " * ║  1. Edit genesis-models.js (the SOURCE file)                             ║\n" +
  " * ║  2. Run: node packages/llm/src/config/genesis-models.js                  ║\n" +
  " * ║                                                                          ║\n" +
  " * ║  ANY CHANGES TO THIS FILE WILL BE OVERWRITTEN!                           ║\n" +
  " * ║                                                                          ║\n" +
  " * ╚══════════════════════════════════════════════════════════════════════════╝\n" +
  " */\n\n" +
  'import type { ModelMetadata } from "./model-registry";\n\n' +
  "export const ESSENTIAL_MODELS: ModelMetadata[] = " +
  JSON.stringify(essentialModels, null, 2) +
  ";\n\n" +
  "// =============================================================================\n" +
  "// ElevenLabs Model Configurations (for UI model selection)\n" +
  "// =============================================================================\n\n" +
  "/**\n" +
  " * ElevenLabs TTS model configuration entry\n" +
  " */\n" +
  "export interface ElevenLabsModelConfig {\n" +
  "  id: string;\n" +
  "  label: string;\n" +
  "  description: string;\n" +
  "  languages: number;\n" +
  "  experimental: boolean;\n" +
  "}\n\n" +
  "/**\n" +
  " * ElevenLabs TTS models for UI selection\n" +
  " * Keys: multilingual_v2, v3, flash_v2_5, turbo_v2_5\n" +
  " */\n" +
  "export const ELEVENLABS_TTS_MODELS = " +
  JSON.stringify(elevenLabsTtsModels, null, 2) +
  " as const;\n\n" +
  "/**\n" +
  " * ElevenLabs STT models for UI selection\n" +
  " */\n" +
  "export const ELEVENLABS_STT_MODELS = " +
  JSON.stringify(elevenLabsSttModels, null, 2) +
  " as const;\n\n" +
  "/**\n" +
  " * Union type of all ElevenLabs TTS model IDs\n" +
  " */\n" +
  'export type ElevenLabsTtsModelId = (typeof ELEVENLABS_TTS_MODELS)[keyof typeof ELEVENLABS_TTS_MODELS]["id"];\n\n' +
  "/**\n" +
  " * Union type of all ElevenLabs STT model IDs\n" +
  " */\n" +
  'export type ElevenLabsSttModelId = (typeof ELEVENLABS_STT_MODELS)[keyof typeof ELEVENLABS_STT_MODELS]["id"];\n\n' +
  "// =============================================================================\n" +
  "// Model Lookup Utilities\n" +
  "// =============================================================================\n\n" +
  "/**\n" +
  " * Get all essential model IDs as a string array\n" +
  " */\n" +
  "export function getEssentialModelIds(): string[] {\n" +
  "  return ESSENTIAL_MODELS.map((m) => m.id);\n" +
  "}\n\n" +
  "/**\n" +
  " * Look up model metadata by ID\n" +
  " * Returns undefined if model is not found in the essential models registry\n" +
  " */\n" +
  "export function getModelMetadata(modelId: string): ModelMetadata | undefined {\n" +
  "  return ESSENTIAL_MODELS.find((m) => m.id === modelId);\n" +
  "}\n\n" +
  "/**\n" +
  " * Union type of all essential model IDs\n" +
  " * Derives from ESSENTIAL_MODELS array for type safety\n" +
  " */\n" +
  'export type EssentialModelId = (typeof ESSENTIAL_MODELS)[number]["id"];\n';

fs.writeFileSync(outputPath, tsContent);
fs.writeFileSync(inputPath, JSON.stringify(filteredJson, null, 2));

console.log("Successfully created " + outputPath + " with " + essentialModels.length + " models.");
console.log("Successfully updated " + inputPath + " with filtered models.");
