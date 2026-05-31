/**
 * Variable Operations Utility
 *
 * Shared logic for applying variable operations to a storage object.
 * Used by both the simulator (in-memory) and API (database) implementations.
 */

import type { VariableOperation } from "@journey/schemas";

// Re-export for convenience
export type { VariableOperation } from "@journey/schemas";

/**
 * Apply variable operations to a storage object (mutates in place)
 *
 * @param storage - The storage object to apply operations to
 * @param operations - Array of operations to apply
 * @returns The mutated storage object (for chaining)
 *
 * @example
 * ```ts
 * const vars: Record<string, unknown> = { count: 5 };
 * applyVariableOperations(vars, [
 *   { op: "increment", key: "count", amount: 2 },
 *   { op: "set", key: "name", value: "John" },
 * ]);
 * // vars = { count: 7, name: "John" }
 * ```
 */
export function applyVariableOperations(
  storage: Record<string, unknown>,
  operations: VariableOperation[]
): Record<string, unknown> {
  for (const op of operations) {
    switch (op.op) {
      case "set":
        storage[op.key] = op.value;
        break;

      case "delete":
        delete storage[op.key];
        break;

      case "increment": {
        const current = typeof storage[op.key] === "number" ? (storage[op.key] as number) : 0;
        storage[op.key] = current + (op.amount ?? 1);
        break;
      }

      case "decrement": {
        const current = typeof storage[op.key] === "number" ? (storage[op.key] as number) : 0;
        storage[op.key] = current - (op.amount ?? 1);
        break;
      }

      case "push": {
        const currentArr = Array.isArray(storage[op.key]) ? (storage[op.key] as unknown[]) : [];
        currentArr.push(op.value);
        storage[op.key] = currentArr;
        break;
      }

      case "pop": {
        const currentArr = Array.isArray(storage[op.key]) ? (storage[op.key] as unknown[]) : [];
        currentArr.pop();
        storage[op.key] = currentArr;
        break;
      }

      case "merge": {
        const currentObj =
          typeof storage[op.key] === "object" && storage[op.key] !== null && !Array.isArray(storage[op.key])
            ? (storage[op.key] as Record<string, unknown>)
            : {};
        storage[op.key] = { ...currentObj, ...(op.value as Record<string, unknown>) };
        break;
      }
    }
  }

  return storage;
}

/**
 * Apply tag operations to a tag array (mutates in place)
 *
 * @param tags - The tag array to apply operations to
 * @param operations - Object with add and remove arrays
 * @returns The mutated tag array (for chaining)
 *
 * @example
 * ```ts
 * const tags: string[] = ["existing"];
 * applyTagOperations(tags, { add: ["new"], remove: ["existing"] });
 * // tags = ["new"]
 * ```
 */
export function applyTagOperations(
  tags: string[],
  operations: { add?: string[]; remove?: string[] }
): string[] {
  // Add tags
  if (operations.add) {
    for (const tag of operations.add) {
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
  }

  // Remove tags
  if (operations.remove) {
    for (const tag of operations.remove) {
      const index = tags.indexOf(tag);
      if (index > -1) {
        tags.splice(index, 1);
      }
    }
  }

  return tags;
}

