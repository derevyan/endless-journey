/**
 * Variable Resolution
 *
 * Re-exports variable resolution utilities.
 *
 * @module lib/variables
 */

export * from "./variable-resolver";
export { type SchemaVariable } from "./schema-resolver";
export { sanitizeNodeLabel } from "./sanitize";
export { wrapVariablePath, unwrapVariablePath } from "./format";
export {
  validateTemplate,
  isValidVariablePath,
  extractVariablePaths,
  type ValidationResult,
  type VariableValidationError,
} from "./variable-validator";
