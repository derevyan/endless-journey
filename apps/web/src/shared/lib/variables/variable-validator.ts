/**
 * Variable Validator
 *
 * Validates template variables against available variables and provides
 * fuzzy suggestions for undefined variables.
 *
 * @module lib/variables/variable-validator
 */

import { fuzzyFilter, type FuzzyMatchResult } from "@/shared/lib/fuzzy-match";
import type { AvailableVariable } from "./variable-resolver";

export interface VariableValidationError {
  /** The invalid variable path */
  path: string;
  /** Error type */
  type: "undefined_variable" | "invalid_syntax";
  /** Human-readable error message */
  message: string;
  /** Position in template string */
  position: { start: number; end: number };
  /** Suggested variables with match scores */
  suggestions: Array<AvailableVariable & { matchResult: FuzzyMatchResult }>;
}

export interface ValidationResult {
  /** True if all variables are valid */
  valid: boolean;
  /** List of validation errors */
  errors: VariableValidationError[];
}

/**
 * Validate template variables against available variables.
 * Uses fuzzy matching to suggest corrections for undefined variables.
 *
 * @param template - Template string containing {{variable}} patterns
 * @param availableVariables - List of available variables for validation
 * @returns Validation result with errors and suggestions
 *
 * @example
 * const result = validateTemplate("Hello {{user.firstNme}}!", availableVars);
 * if (!result.valid) {
 *   console.log(result.errors[0].suggestions[0].path); // "user.firstName"
 * }
 */
export function validateTemplate(
  template: string,
  availableVariables: AvailableVariable[]
): ValidationResult {
  const errors: VariableValidationError[] = [];
  const pattern = /\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null;

  const availablePaths = new Set(availableVariables.map((v) => v.path));

  while ((match = pattern.exec(template)) !== null) {
    const path = match[1].trim();
    const start = match.index;
    const end = match.index + match[0].length;

    if (!availablePaths.has(path)) {
      // Use existing fuzzyFilter for suggestions
      const suggestions = fuzzyFilter(path, availableVariables, (v) => v.path).slice(0, 3);

      errors.push({
        path,
        type: "undefined_variable",
        message: `Variable "${path}" not found`,
        position: { start, end },
        suggestions,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check if a single variable path is valid.
 * Lighter-weight check when you don't need suggestions.
 *
 * @param path - Variable path to check (without {{ }})
 * @param availableVariables - List of available variables
 * @returns True if variable exists
 */
export function isValidVariablePath(path: string, availableVariables: AvailableVariable[]): boolean {
  return availableVariables.some((v) => v.path === path);
}

/**
 * Extract all variable paths from a template string.
 *
 * @param template - Template string containing {{variable}} patterns
 * @returns Array of variable paths found in the template
 *
 * @example
 * extractVariablePaths("{{user.name}} and {{session.id}}")
 * // Returns: ["user.name", "session.id"]
 */
export function extractVariablePaths(template: string): string[] {
  const paths: string[] = [];
  const pattern = /\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(template)) !== null) {
    paths.push(match[1].trim());
  }

  return paths;
}
