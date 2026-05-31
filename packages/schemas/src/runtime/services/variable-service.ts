import type { VariableScope, VariableOperation } from "../../variables";
import type { VariableAction } from "../../nodes";

/**
 * Variable service interface for reading and writing variables.
 *
 * This interface provides a unified API for variable access across all modules:
 * - Journey Engine (ExecutionContext)
 * - Workflow Runner (WorkflowContext)
 * - LLM Tools (BuiltinToolContext)
 *
 * @example
 * ```typescript
 * // Get a single variable
 * const userName = await services.variable.getValue("journey", "userName");
 *
 * // Set a variable
 * await services.variable.setValue("journey", "step", "completed");
 *
 * // Get all variables for a scope
 * const allJourneyVars = await services.variable.getAll("journey");
 *
 * // Execute a complex operation
 * await services.variable.executeOperation("journey", { op: "increment", key: "visits", amount: 1 });
 * ```
 */
export interface IVariableService {
  // =========================================================================
  // Required Methods (must be implemented)
  // =========================================================================

  /**
   * Get all variables for a scope.
   * This is the primary method for reading variables.
   *
   * @param scope - The variable scope
   * @returns Record of key-value pairs for the scope
   */
  getAll(scope: VariableScope): Promise<Record<string, unknown>>;

  /**
   * Execute a complete variable action (may contain operations for multiple scopes).
   * This is the method used by node executors to apply all variable changes at once.
   *
   * @param action - The variable action containing operations for journey, global, and user scopes
   */
  executeAction(action: VariableAction): Promise<void>;

  // =========================================================================
  // Optional Methods (convenience extensions)
  // =========================================================================

  /**
   * Get a single variable value by scope and key.
   *
   * @param scope - The variable scope ("journey", "global", or "user")
   * @param key - The variable key
   * @returns The variable value, or undefined if not found
   */
  getValue?(scope: VariableScope, key: string): Promise<unknown>;

  /**
   * Set a single variable value.
   *
   * @param scope - The variable scope ("journey", "global", or "user")
   * @param key - The variable key
   * @param value - The value to set
   */
  setValue?(scope: VariableScope, key: string, value: unknown): Promise<void>;

  /**
   * Execute a single variable operation (set, delete, increment, etc.).
   *
   * @param scope - The variable scope
   * @param operation - The operation to execute
   */
  executeOperation?(scope: VariableScope, operation: VariableOperation): Promise<void>;

  /**
   * Delete a variable by key.
   *
   * @param scope - The variable scope
   * @param key - The variable key to delete
   */
  delete?(scope: VariableScope, key: string): Promise<void>;

  /**
   * Check if a variable exists.
   *
   * @param scope - The variable scope
   * @param key - The variable key
   * @returns True if the variable exists
   */
  exists?(scope: VariableScope, key: string): Promise<boolean>;
}
