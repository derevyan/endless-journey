/**
 * Template Service
 *
 * Handles variable substitution in template strings.
 * Supports two modes:
 * - Simple: {{path.to.value}} - Direct variable lookup
 * - Expression: {{= expr }} - JEXL expression evaluation
 *
 * Arrays and objects are automatically JSON-serialized to avoid [object Object].
 * Use {{path.*}} for pretty-printed JSON (2-space indentation).
 *
 * Used for webhook URLs, headers, request bodies, and message content.
 */

import { createLogger } from "@journey/logger";
import type { TemplateService } from "../types";
import { getNestedValue } from "../utils";
import { evaluateExpressionSync } from "./expression-service";

const log = createLogger("template-service");

/**
 * Options for creating a template service
 */
export interface TemplateServiceOptions {
  /**
   * Callback invoked when a variable path is not found in the context.
   * Useful for debugging missing variables in templates.
   *
   * @param path - The variable path that was not found
   * @param template - The original template string
   */
  onMissingVariable?: (path: string, template: string) => void;

  /**
   * Callback invoked when an expression evaluation fails.
   * Useful for debugging expression errors.
   *
   * @param expression - The expression that failed
   * @param error - The error that occurred
   * @param template - The original template string
   */
  onExpressionError?: (expression: string, error: Error, template: string) => void;
}

/**
 * Create a template service instance
 *
 * @param options - Optional configuration for debugging callbacks
 * @returns TemplateService implementation
 *
 * @example
 * ```ts
 * const template = createTemplateService();
 *
 * // Simple mode: {{path}}
 * template.substitute("Hello {{user.name}}", { user: { name: "John" } });
 * // "Hello John"
 *
 * // Expression mode: {{= expression }}
 * template.substitute("Hello {{= upper(user.name) }}", { user: { name: "John" } });
 * // "Hello JOHN"
 *
 * // Ternary expressions
 * template.substitute("Status: {{= user.points > 100 ? 'VIP' : 'Standard' }}", { user: { points: 150 } });
 * // "Status: VIP"
 *
 * // With debugging callback
 * const templateWithDebug = createTemplateService({
 *   onMissingVariable: (path, template) => log.warn({ path, template }, "template:missingVariable"),
 * });
 * ```
 */
export function createTemplateService(options?: TemplateServiceOptions): TemplateService {
  return {
    substitute(template: string, context: Record<string, unknown>): string {
      if (typeof template !== "string") {
        return "";
      }

      // 1. Expression mode: {{= expr }}
      // Uses JEXL for full expression evaluation with functions
      let result = template.replace(/\{\{=\s*(.+?)\s*\}\}/g, (match, expr) => {
        const trimmedExpr = expr.trim();
        try {
          const value = evaluateExpressionSync(trimmedExpr, context);
          if (value === undefined || value === null) {
            log.debug({ expression: trimmedExpr }, "template:expressionReturnedNullOrUndefined");
            return "";
          }
          return String(value);
        } catch (error) {
          // Log expression errors but return empty string to avoid exposing template syntax
          const errorObj = error instanceof Error ? error : new Error(String(error));
          log.warn(
            { expression: trimmedExpr, error: errorObj.message },
            "template:expressionEvaluationFailed"
          );
          // Call callback if provided
          options?.onExpressionError?.(trimmedExpr, errorObj, template);
          return "";
        }
      });

      // 2. Simple mode: {{path.to.value}} or {{path.*}} for JSON dump
      // Direct path lookup (faster for simple cases)
      // Wildcard mode: {{path.*}} returns JSON.stringify of the object at path
      result = result.replace(/\{\{([^}=]+)\}\}/g, (match, path) => {
        const trimmedPath = path.trim();

        // Check for wildcard pattern: {{path.*}} → JSON dump entire object
        if (trimmedPath.endsWith(".*")) {
          const basePath = trimmedPath.slice(0, -2); // Remove '.*'
          const value = basePath ? getNestedValue(context, basePath) : context;
          if (value === undefined || value === null) {
            log.debug({ path: basePath, wildcard: true }, "template:wildcardPathNotResolved");
            options?.onMissingVariable?.(trimmedPath, template);
            return "{}";
          }
          // Return pretty-printed JSON for LLM readability
          try {
            return JSON.stringify(value, null, 2);
          } catch {
            log.warn({ path: basePath }, "template:wildcardJsonStringifyFailed");
            return "{}";
          }
        }

        // Standard path lookup
        const value = getNestedValue(context, trimmedPath);

        if (value === undefined || value === null) {
          // Log unresolved paths at debug level (common during development)
          log.debug({ path: trimmedPath }, "template:pathNotResolved");
          // Call callback if provided
          options?.onMissingVariable?.(trimmedPath, template);
          return "";
        }

        // Auto-serialize arrays and objects to JSON (avoids [object Object] issue)
        if (typeof value === "object") {
          try {
            return JSON.stringify(value);
          } catch {
            log.warn({ path: trimmedPath }, "template:jsonStringifyFailed");
            return Array.isArray(value) ? "[]" : "{}";
          }
        }

        return String(value);
      });

      return result;
    },
  };
}
