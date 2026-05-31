/**
 * Service Configuration Validator
 *
 * Validates that required services are properly configured and available.
 * Helps catch configuration errors early at startup rather than failing silently
 * when handlers try to use missing services.
 *
 * CRITICAL: If required services are not configured, persistence operations
 * will fail silently, causing data loss (conversations lost after cache expiry).
 */

import { createLogger } from "@journey/logger";
import type { EngineServices } from "../types";

const log = createLogger("engine:service-validator");

/**
 * Validation result
 */
export interface ServiceValidationResult {
  valid: boolean;
  missingServices: string[];
  errors: string[];
}

/**
 * Critical services that MUST be configured
 * These services are essential for data persistence and agent functionality
 *
 * Currently empty - all critical services are created internally by the engine.
 * This array is kept for future use when external dependencies become critical.
 * Previously included conversationHistory (internal to engine) and agentConversationStore
 * (never implemented - was planned but not executed).
 */
const CRITICAL_SERVICES = [] as const;

/**
 * Important services that should be configured
 * Missing these will cause degraded functionality but not data loss
 */
const IMPORTANT_SERVICES = [
  "messenger",
  "timer",
  "variable",
  "template",
  "eventLogger",
] as const;

/**
 * Validate that all critical services are configured
 *
 * @param services - Engine services object to validate
 * @returns ValidationResult with any missing or invalid services
 *
 * @throws Error if critical services are missing
 */
export function validateServiceConfiguration(services: Partial<EngineServices>): ServiceValidationResult {
  const missingServices: string[] = [];
  const errors: string[] = [];

  // Validate critical services
  for (const service of CRITICAL_SERVICES) {
    if (!services[service as keyof EngineServices]) {
      missingServices.push(service);
      errors.push(`CRITICAL: Service '${service}' is not configured - conversations will not persist`);
    } else if (typeof services[service as keyof EngineServices] !== "object") {
      errors.push(`CRITICAL: Service '${service}' is not properly initialized (not an object)`);
    }
  }

  // Warn about important services
  for (const service of IMPORTANT_SERVICES) {
    if (!services[service as keyof EngineServices]) {
      log.warn({}, `Important service '${service}' is not configured - some functionality may be unavailable`);
    }
  }

  const valid = missingServices.length === 0 && errors.length === 0;

  return {
    valid,
    missingServices,
    errors,
  };
}

/**
 * Validate and throw if critical services are missing
 *
 * @param services - Engine services object to validate
 * @throws Error if critical services are missing
 */
export function assertServiceConfiguration(services: Partial<EngineServices>): void {
  const result = validateServiceConfiguration(services);

  if (!result.valid) {
    const errorMessages = [
      "Service configuration validation failed:",
      ...result.errors,
      "",
      "This typically happens when:",
      "1. Services are not properly initialized in the engine factory",
      "2. The dependency injection container is not configured correctly",
      "3. Critical services are missing from the service factory",
      "",
      'See: packages/engine/src/services/service-factory.ts',
    ].join("\n");

    log.error(
      {
        missingServices: result.missingServices,
        errorCount: result.errors.length,
      },
      "service:validation:failed"
    );

    throw new Error(errorMessages);
  }

  log.debug({}, "service:validation:passed");
}

/**
 * Get a human-readable description of required services
 */
export function getServiceRequirements(): { critical: string[]; important: string[] } {
  return {
    critical: Array.from(CRITICAL_SERVICES),
    important: Array.from(IMPORTANT_SERVICES),
  };
}

/**
 * Log service configuration status for debugging
 */
export function logServiceStatus(services: Partial<EngineServices>): void {
  const configured: string[] = [];
  const missing: string[] = [];

  const allServices = [...CRITICAL_SERVICES, ...IMPORTANT_SERVICES];
  for (const service of allServices) {
    if (services[service as keyof EngineServices]) {
      configured.push(service);
    } else {
      missing.push(service);
    }
  }

  log.info(
    {
      configured,
      missing,
      configuredCount: configured.length,
      missingCount: missing.length,
    },
    "service:configuration:status"
  );
}
