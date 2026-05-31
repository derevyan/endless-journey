/**
 * Variable Schemas
 *
 * Split from variables.ts for better organization:
 * - conversions.ts: Type conversion utilities
 * - operations.ts: Variable scope and operations
 * - data.ts: Variable data schemas for API
 * - namespaces.ts: Template resolution context
 */

// Re-export from centralized location (avoids circular imports)
export { VariableValueSchema } from "../value-types";
export type { VariableValue } from "../value-types";

// Type conversion utilities
export {
  isEmpty,
  isTruthy,
  toNumber,
  toString,
  toExprEvalContext,
  prepareForCondition,
} from "./conversions";

// Variable scope and operations
export {
  VariableScopeSchema,
  type VariableScope,
  SetOperationSchema,
  DeleteOperationSchema,
  IncrementOperationSchema,
  DecrementOperationSchema,
  PushOperationSchema,
  PopOperationSchema,
  MergeOperationSchema,
  VariableOperationSchema,
  type VariableOperation,
} from "./operations";

// Variable data schemas
export {
  VariableDataSchema,
  type VariableData,
  GlobalVariableSchema,
  type GlobalVariable,
  JourneyVariableSchema,
  type JourneyVariable,
  UserVariableSchema,
  type UserVariable,
  ExecuteVariableOperationsRequestSchema,
  type ExecuteVariableOperationsRequest,
} from "./data";

// Variable namespaces for template resolution
export {
  type UserProfile,
  type SessionInfo,
  type ScopedVariables,
  type VariableNamespaces,
  type NodeOutputEntry,
  type BuildVariableNamespacesOptions,
  buildVariableNamespaces,
} from "./namespaces";

// Variable schema definitions (JSON Schema-like type definitions)
export {
  VariableFormatValues,
  VariableFormatSchema,
  type VariableFormat,
  VariableTypeValues,
  VariableTypeSchema,
  type VariableType,
  VariablePropertySchema,
  type VariableProperty,
  VariableSchemasSchema,
  type VariableSchemas,
} from "./variable-schema";

// Default variable schemas
export { DEFAULT_USER_SCHEMA, DEFAULT_SESSION_SCHEMA, DEFAULT_VARIABLE_SCHEMAS } from "./default-schemas";
