/**
 * Circuit Breaker Default Configurations
 *
 * Environment variable overrides available for all settings.
 * Each service type has tuned defaults based on expected behavior.
 */

import type { CircuitBreakerConfig, CircuitServiceType } from "./types";

/** Default configurations per service type */
export const defaultConfigs: Record<CircuitServiceType, Omit<CircuitBreakerConfig, "name">> = {
  /**
   * LLM services (OpenAI, Anthropic, Google)
   * - Longer timeout (30s) for complex generations
   * - 50% error threshold - balanced sensitivity
   * - 60s reset timeout - give provider time to recover
   */
  llm: {
    serviceType: "llm",
    timeout: parseInt(process.env.CB_LLM_TIMEOUT ?? "30000", 10),
    errorThresholdPercentage: parseInt(process.env.CB_LLM_ERROR_THRESHOLD ?? "50", 10),
    volumeThreshold: parseInt(process.env.CB_LLM_VOLUME_THRESHOLD ?? "10", 10),
    resetTimeout: parseInt(process.env.CB_LLM_RESET_TIMEOUT ?? "60000", 10),
    enabled: process.env.CB_LLM_ENABLED !== "false",
  },

  /**
   * Webhook calls (external APIs)
   * - 30s timeout matches existing webhook executor default
   * - 60% error threshold - slightly more tolerant for varied endpoints
   * - 30s reset timeout - shorter for faster recovery
   */
  webhook: {
    serviceType: "webhook",
    timeout: parseInt(process.env.CB_WEBHOOK_TIMEOUT ?? "30000", 10),
    errorThresholdPercentage: parseInt(process.env.CB_WEBHOOK_ERROR_THRESHOLD ?? "60", 10),
    volumeThreshold: parseInt(process.env.CB_WEBHOOK_VOLUME_THRESHOLD ?? "10", 10),
    resetTimeout: parseInt(process.env.CB_WEBHOOK_RESET_TIMEOUT ?? "30000", 10),
    enabled: process.env.CB_WEBHOOK_ENABLED !== "false",
  },

  /**
   * Telegram API calls
   * - 15s timeout - Telegram usually responds quickly
   * - 50% error threshold - balanced sensitivity
   * - 45s reset timeout - moderate recovery time
   */
  telegram: {
    serviceType: "telegram",
    timeout: parseInt(process.env.CB_TELEGRAM_TIMEOUT ?? "15000", 10),
    errorThresholdPercentage: parseInt(process.env.CB_TELEGRAM_ERROR_THRESHOLD ?? "50", 10),
    volumeThreshold: parseInt(process.env.CB_TELEGRAM_VOLUME_THRESHOLD ?? "10", 10),
    resetTimeout: parseInt(process.env.CB_TELEGRAM_RESET_TIMEOUT ?? "45000", 10),
    enabled: process.env.CB_TELEGRAM_ENABLED !== "false",
  },

  /**
   * CRM operations (database-backed)
   * - 10s timeout - local database calls
   * - 50% error threshold
   * - 30s reset timeout
   */
  crm: {
    serviceType: "crm",
    timeout: parseInt(process.env.CB_CRM_TIMEOUT ?? "10000", 10),
    errorThresholdPercentage: parseInt(process.env.CB_CRM_ERROR_THRESHOLD ?? "50", 10),
    volumeThreshold: parseInt(process.env.CB_CRM_VOLUME_THRESHOLD ?? "10", 10),
    resetTimeout: parseInt(process.env.CB_CRM_RESET_TIMEOUT ?? "30000", 10),
    enabled: process.env.CB_CRM_ENABLED !== "false",
  },

  /**
   * MCP service (standalone tool server)
   * - 30s timeout - MCP tool calls can take time (web fetches, etc.)
   * - 50% error threshold
   * - 30s reset timeout - moderate recovery time
   */
  mcp: {
    serviceType: "mcp",
    timeout: parseInt(process.env.CB_MCP_TIMEOUT ?? "30000", 10),
    errorThresholdPercentage: parseInt(process.env.CB_MCP_ERROR_THRESHOLD ?? "50", 10),
    volumeThreshold: parseInt(process.env.CB_MCP_VOLUME_THRESHOLD ?? "10", 10),
    resetTimeout: parseInt(process.env.CB_MCP_RESET_TIMEOUT ?? "30000", 10),
    enabled: process.env.CB_MCP_ENABLED !== "false",
  },
};

/**
 * Get merged configuration with defaults
 */
export function getConfig(config: CircuitBreakerConfig): Required<CircuitBreakerConfig> {
  const defaults = defaultConfigs[config.serviceType];
  return {
    name: config.name,
    serviceType: config.serviceType,
    timeout: config.timeout ?? defaults.timeout ?? 30000,
    errorThresholdPercentage: config.errorThresholdPercentage ?? defaults.errorThresholdPercentage ?? 50,
    volumeThreshold: config.volumeThreshold ?? defaults.volumeThreshold ?? 10,
    resetTimeout: config.resetTimeout ?? defaults.resetTimeout ?? 30000,
    enabled: config.enabled ?? defaults.enabled ?? true,
  };
}
