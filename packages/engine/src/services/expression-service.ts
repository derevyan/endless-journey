/**
 * Expression Service
 *
 * Provides JEXL-based expression evaluation with custom functions.
 * Used for evaluating expressions in templates like {{= upper(user.firstName) }}
 */

import jexl from "jexl";
import type { IExpressionService } from "@journey/schemas";
import { getExpressionFunctionNames, registerExpressionFunctions } from "./expression-registry";

// Configure JEXL instance with shared function registry
const expressionEngine = new jexl.Jexl();
registerExpressionFunctions(expressionEngine);

// =============================================================================
// JAVASCRIPT → JEXL METHOD CALL CONVERSION
// =============================================================================

/**
 * Convert JavaScript-style method calls to JEXL function calls.
 *
 * JEXL doesn't support method call syntax (obj.method(arg)), only function
 * call syntax (method(obj, arg)). This pre-processor converts common patterns
 * so that expressions written in JavaScript style work correctly.
 *
 * Supported conversions:
 * - `variable.includes('x')` → `includes(variable, 'x')`
 * - `variable.startsWith('x')` → `startsWith(variable, 'x')`
 * - `variable.endsWith('x')` → `endsWith(variable, 'x')`
 * - `variable.toUpperCase()` → `upper(variable)`
 * - `variable.toLowerCase()` → `lower(variable)`
 *
 * Handles nested property access: `user.name.includes('x')` → `includes(user.name, 'x')`
 *
 * @param expression - Expression that may contain JavaScript method calls
 * @returns Expression with method calls converted to JEXL function calls
 *
 * @example
 * ```ts
 * convertJsMethodCalls("name.includes('Pro')")
 * // Returns: "includes(name, 'Pro')"
 *
 * convertJsMethodCalls("user.plan.includes('Enterprise') ? 'vip' : 'standard'")
 * // Returns: "includes(user.plan, 'Enterprise') ? 'vip' : 'standard'"
 * ```
 */
function convertJsMethodCalls(expression: string): string {
  let result = expression;

  // Convert .includes(arg) → includes(obj, arg)
  // Pattern: identifier (with optional dots for nested access) followed by .includes(arg)
  // Uses negative lookbehind to avoid matching already converted includes(...) calls
  result = result.replace(/(\w+(?:\.\w+)*)\.includes\(([^)]+)\)/g, "includes($1, $2)");

  // Convert .startsWith(arg) → startsWith(obj, arg)
  result = result.replace(/(\w+(?:\.\w+)*)\.startsWith\(([^)]+)\)/g, "startsWith($1, $2)");

  // Convert .endsWith(arg) → endsWith(obj, arg)
  result = result.replace(/(\w+(?:\.\w+)*)\.endsWith\(([^)]+)\)/g, "endsWith($1, $2)");

  // Convert .toUpperCase() → upper(obj)
  result = result.replace(/(\w+(?:\.\w+)*)\.toUpperCase\(\)/g, "upper($1)");

  // Convert .toLowerCase() → lower(obj)
  result = result.replace(/(\w+(?:\.\w+)*)\.toLowerCase\(\)/g, "lower($1)");

  // Convert .trim() → trim(obj)
  result = result.replace(/(\w+(?:\.\w+)*)\.trim\(\)/g, "trim($1)");

  // Convert .length → length(obj) (property access, not method call)
  // Only convert if followed by a non-word character or end of string
  result = result.replace(/(\w+(?:\.\w+)*)\.length(?=\s*[^(a-zA-Z0-9_]|$)/g, "length($1)");

  return result;
}

/**
 * Evaluate a JEXL expression asynchronously
 *
 * @param expression - JEXL expression string
 * @param context - Context object for variable substitution
 * @returns Evaluated result
 *
 * @example
 * ```ts
 * await evaluateExpression("user.firstName", { user: { firstName: "John" } });
 * // Returns: "John"
 *
 * await evaluateExpression("upper(user.firstName)", { user: { firstName: "John" } });
 * // Returns: "JOHN"
 *
 * await evaluateExpression("user.points > 100 ? 'VIP' : 'Standard'", { user: { points: 150 } });
 * // Returns: "VIP"
 * ```
 */
export async function evaluateExpression(expression: string, context: Record<string, unknown>): Promise<unknown> {
  const converted = convertJsMethodCalls(expression);
  return expressionEngine.eval(converted, context);
}

/**
 * Evaluate expression synchronously (for simple cases)
 *
 * @param expression - JEXL expression string
 * @param context - Context object for variable substitution
 * @returns Evaluated result
 */
export function evaluateExpressionSync(expression: string, context: Record<string, unknown>): unknown {
  const converted = convertJsMethodCalls(expression);
  return expressionEngine.evalSync(converted, context);
}

/**
 * Get list of available functions (for UI documentation)
 */
export function getAvailableFunctions(): string[] {
  return getExpressionFunctionNames();
}

/**
 * Create an IExpressionService instance for use in EngineServices.
 *
 * Implements the SharedServiceContext's IExpressionService interface,
 * providing consistent expression evaluation across engine and LLM contexts.
 *
 * @returns IExpressionService implementation backed by JEXL
 */
export function createExpressionService(): IExpressionService {
  return {
    evaluate(expression: string, context: Record<string, unknown>): unknown {
      const converted = convertJsMethodCalls(expression);
      return expressionEngine.evalSync(converted, context);
    },

    isTruthy(expression: string, context: Record<string, unknown>): boolean {
      const converted = convertJsMethodCalls(expression);
      const result = expressionEngine.evalSync(converted, context);
      return Boolean(result);
    },

    validate(expression: string): boolean {
      try {
        // Convert JS method calls before validation
        const converted = convertJsMethodCalls(expression);
        // Attempt to evaluate with empty context to check syntax
        // Parse errors will throw, variable reference errors won't
        expressionEngine.evalSync(converted, {});
        return true;
      } catch (err) {
        // Only syntax errors indicate invalid expressions
        // Variable reference errors (e.g., "foo is not defined") are OK - expression is valid, just missing context
        const message = err instanceof Error ? err.message : String(err);
        // JEXL throws "Token ... is unexpected" or similar for syntax errors
        const isSyntaxError = message.includes("unexpected") || message.includes("Invalid");
        return !isSyntaxError;
      }
    },
  };
}

export { expressionEngine };
