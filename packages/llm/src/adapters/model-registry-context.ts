import { createLogger } from "@journey/logger";
import { NoopModelAdapter } from "./model-registry-adapter";
import type { ModelRegistryAdapter } from "./model-registry-adapter";

const log = createLogger("llm:adapters:modelRegistry");

/**
 * Global model registry adapter (default: noop)
 * Set via setModelRegistryAdapter() during app initialization
 */
let globalAdapter: ModelRegistryAdapter = new NoopModelAdapter();

/**
 * Set the global model registry adapter
 * Call during server startup to wire up the concrete implementation
 *
 * @param adapter - Adapter implementation (EssentialModelAdapter for all environments)
 */
export function setModelRegistryAdapter(adapter: ModelRegistryAdapter): void {
  globalAdapter = adapter;
  log.info({}, "llm:adapters:modelRegistry:set");
}

/**
 * Get the current model registry adapter
 * Returns the global adapter instance
 */
export function getModelRegistryAdapter(): ModelRegistryAdapter {
  return globalAdapter;
}

/**
 * Check if adapter is ready
 * Useful for ensuring initialization before making calls
 */
export function isModelRegistryReady(): boolean {
  return globalAdapter.isReady?.() ?? true;
}
