import { createLogger, serializeError } from "@journey/logger";
import { ValidationError } from "@journey/schemas";
import type { StateParameter, SystemAgent } from "@journey/schemas";
import type { PipelineContext } from "../types";

const log = createLogger("mindstate:validation");

/**
 * Validates the pipeline context before execution
 * Prevents silent failures by enforcing required invariants
 *
 * Rules:
 * 1. At least one system agent must be present (prevents workload.ts crash)
 * 2. userState array must be defined (can be empty)
 * 3. messages array must be defined (can be empty)
 * 4. mainAgent must be present
 * 5. CATEGORICAL parameters must have non-empty options array
 */
export function validatePipelineContext(context: PipelineContext): void {
  // Rule 1: At least one system agent required
  if (!context.systemAgents || context.systemAgents.length === 0) {
    throw new ValidationError(
      "Pipeline requires at least one system agent",
      "systemAgents"
    );
  }

  // Rule 2: Arrays must be defined (can be empty)
  if (!context.userState) {
    throw new ValidationError("userState must be defined", "userState");
  }

  if (!context.messages) {
    throw new ValidationError("messages must be defined", "messages");
  }

  // Rule 3: Main agent required
  if (!context.mainAgent) {
    throw new ValidationError("mainAgent is required", "mainAgent");
  }

  // Rule 4: Validate categorical parameters have options
  context.userState.forEach(param => {
    if (param.scaleType === "CATEGORICAL") {
      if (!param.options || param.options.length === 0) {
        throw new ValidationError(
          `CATEGORICAL parameter '${param.name}' must have at least one option`,
          "options",
          { parameterId: param.id }
        );
      }
    }
  });

  // Rule 5: Validate currentValue type matches scaleType
  context.userState.forEach(param => {
    if (param.scaleType === "NUMERIC" && typeof param.currentValue !== "number") {
      throw new ValidationError(
        `NUMERIC parameter '${param.name}' has non-numeric currentValue: ${typeof param.currentValue}`,
        "currentValue",
        { parameterId: param.id }
      );
    }

    if (param.scaleType === "BOOLEAN" && typeof param.currentValue !== "boolean") {
      throw new ValidationError(
        `BOOLEAN parameter '${param.name}' has non-boolean currentValue`,
        "currentValue",
        { parameterId: param.id }
      );
    }

    if (param.scaleType === "CATEGORICAL" && typeof param.currentValue !== "string") {
      throw new ValidationError(
        `CATEGORICAL parameter '${param.name}' has non-string currentValue`,
        "currentValue",
        { parameterId: param.id }
      );
    }
  });

  // Rule 6: Validate numeric ranges
  context.userState.forEach(param => {
    if (param.scaleType === "NUMERIC") {
      if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
        throw new ValidationError(
          `Parameter '${param.name}' has min (${param.min}) > max (${param.max})`,
          "min",
          { parameterId: param.id }
        );
      }
    }
  });

  // Rule 7: Warn on invalid responsibleAgentId
  const agentIds = new Set(context.systemAgents.map(a => a.id));
  context.userState.forEach(param => {
    if (!agentIds.has(param.responsibleAgentId)) {
      log.warn(
        { parameterId: param.id, agentId: param.responsibleAgentId },
        "mindstate:validation:invalidAgentId"
      );
    }
  });

  // Rule 8: Validate categorical currentValue is in options
  context.userState.forEach(param => {
    if (param.scaleType === "CATEGORICAL") {
      if (param.currentValue && typeof param.currentValue === "string") {
        if (param.options && !param.options.includes(param.currentValue)) {
          throw new ValidationError(
            `CATEGORICAL parameter '${param.name}' has currentValue '${param.currentValue}' not in options: ${param.options.join(", ")}`,
            "currentValue",
            { parameterId: param.id }
          );
        }
      }
    }
  });

  // Rule 9: Validate unique parameter IDs
  validateUniqueParameterIds(context.userState);

  // Rule 10: Validate unique agent IDs
  validateUniqueAgentIds(context.systemAgents);

  log.debug({ agentCount: context.systemAgents.length }, "mindstate:validation:passed");
}

/**
 * Validates that all StateParameter IDs are unique
 * Duplicate IDs cause silent overwrites in state updates
 */
export function validateUniqueParameterIds(params: StateParameter[]): void {
  const idCounts = new Map<string, number>();

  for (const param of params) {
    idCounts.set(param.id, (idCounts.get(param.id) ?? 0) + 1);
  }

  const duplicates = Array.from(idCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([id]) => id);

  if (duplicates.length > 0) {
    log.error({ duplicateIds: duplicates }, "mindstate:validation:duplicateParameterIds");
    throw new ValidationError(
      `Duplicate StateParameter IDs found: ${duplicates.join(", ")}`,
      "parameters",
      { duplicateIds: duplicates }
    );
  }
}

/**
 * Validates that all SystemAgent IDs are unique
 * Duplicate IDs cause unpredictable agent dispatch behavior
 */
export function validateUniqueAgentIds(agents: SystemAgent[]): void {
  const idCounts = new Map<string, number>();

  for (const agent of agents) {
    idCounts.set(agent.id, (idCounts.get(agent.id) ?? 0) + 1);
  }

  const duplicates = Array.from(idCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([id]) => id);

  if (duplicates.length > 0) {
    log.error({ duplicateIds: duplicates }, "mindstate:validation:duplicateAgentIds");
    throw new ValidationError(
      `Duplicate SystemAgent IDs found: ${duplicates.join(", ")}`,
      "systemAgents",
      { duplicateIds: duplicates }
    );
  }
}
