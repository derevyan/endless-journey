// Core adapters (portable - no server dependencies)
export type { ModelRegistryAdapter, ModelMetadata } from "./model-registry-adapter";
export { NoopModelAdapter } from "./model-registry-adapter";
export { EssentialModelAdapter } from "./essential-model-adapter";

// Adapter context (global singleton)
export {
  setModelRegistryAdapter,
  getModelRegistryAdapter,
  isModelRegistryReady,
} from "./model-registry-context";

// Re-export usage tracking adapter (already exists in services)
export type { UsageTrackingAdapter } from "../services/usage-tracking-adapter";
export {
  NoopUsageAdapter,
  LoggingUsageAdapter,
  CompositeUsageAdapter,
} from "../services/usage-tracking-adapter";
