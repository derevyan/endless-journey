/**
 * Variable Resolver - Handlebars-style template resolution
 *
 * This module resolves {{variable}} templates in strings and objects.
 */

import { createLogger, serializeError } from "@journey/logger";

import { resolveVariablePath } from "./expression-evaluator";
import { unwrapVariablePath } from "./utilities/unwrap-variable-path";

const log = createLogger("workflow-variable-resolver");

/**
 * Build prompt variables from a mapping configuration.
 *
 * Takes a mapping of prompt variable names to source paths, and resolves
 * each path against the provided context to build the final variables object.
 *
 * Example mapping: { "input": "userResponse.value", "name": "user.firstName" }
 * Example context: { userResponse: { value: "Hello" }, user: { firstName: "Alice" } }
 * Result: { input: "Hello", name: "Alice" }
 *
 * @param mappings - Mapping of prompt var names to source paths
 * @param context - Context object to resolve paths from
 * @returns Variables object for prompt compilation
 */
export function buildPromptVariablesFromMappings(
  mappings: Record<string, string>,
  context: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [promptVar, sourcePath] of Object.entries(mappings)) {
    // Unwrap {{}} before resolving - supports both wrapped and clean paths
    const cleanPath = unwrapVariablePath(sourcePath);
    const value = resolveVariablePath(cleanPath, context);
    if (value !== undefined) {
      result[promptVar] = value;
    } else {
      // Log warning for failed path resolution (no more silent failures)
      log.warn(
        { promptVar, sourcePath: cleanPath },
        "variableResolver:mappingPathNotResolved - promptVariable mapping failed to resolve"
      );
    }
  }

  return result;
}

/**
 * Resolve Handlebars-style templates in a string.
 *
 * Example: "Hello, {{user.firstName}}!" -> "Hello, Alice!"
 *
 * Supports:
 * - Simple paths: {{variable}}
 * - Nested paths: {{result.data.name}}
 * - Multiple templates: {{a}} and {{b}}
 */
export function resolveTemplate(template: string, variables: Record<string, unknown>): string {
  try {
    // Match {{path}} patterns
    const pattern = /\{\{([^}]+)\}\}/g;

    return template.replace(pattern, (_match, path: string) => {
      const trimmedPath = path.trim();
      const value = resolveVariablePath(trimmedPath, variables);

      if (value === undefined || value === null) {
        log.debug({ path: trimmedPath }, "variableResolver:pathNotResolved");
        return ""; // Replace with empty string for missing values
      }

      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch (err) {
          log.warn({ err: serializeError(err), path: trimmedPath }, "variableResolver:jsonStringifyFailed");
          return "[object]";
        }
      }

      return String(value);
    });
  } catch (error) {
    log.error({ err: serializeError(error), template }, "variableResolver:templateResolutionFailed");
    return template; // Return original template as fallback
  }
}

/**
 * Resolve templates in an object recursively.
 */
export function resolveObjectTemplates<T extends Record<string, unknown>>(
  obj: T,
  variables: Record<string, unknown>
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = resolveTemplate(value, variables);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      result[key] = resolveObjectTemplates(value as Record<string, unknown>, variables);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === "string") {
          return resolveTemplate(item, variables);
        }
        if (typeof item === "object" && item !== null) {
          return resolveObjectTemplates(item as Record<string, unknown>, variables);
        }
        return item;
      });
    } else {
      result[key] = value;
    }
  }

  return result as T;
}
