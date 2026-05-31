/**
 * Variable Access Tools
 *
 * Tools for reading variables from different scopes:
 * - read_journey_variable: Journey-scoped variables
 * - read_user_variable: User profile variables
 * - read_mindstate_parameter: Mindstate flow parameters
 *
 * @module tools/builtin/variable-tools
 */

import { serializeError } from "@journey/logger";
import type { AgentTool } from "@journey/schemas";
import { z } from "zod";
import type { BuiltinToolContext, ToolFactory } from "./types";
import { defaultServiceRetryConfig } from "./types";
import { SYSTEM_TOOL_NAMES } from "../unified/tool-names";

// =============================================================================
// PROTECTED VARIABLE CHECK
// =============================================================================

/**
 * Check if a variable name is protected by exact match or regex pattern
 * @param name - Variable name to check
 * @param exactMatches - List of exact variable names to protect
 * @param patterns - List of regex patterns to match against
 * @returns true if variable is protected
 */
function isVariableProtected(name: string, exactMatches: string[], patterns: string[]): boolean {
  // Check exact matches first (faster)
  if (exactMatches.includes(name)) return true;

  // Check regex patterns
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(`^${pattern}$`, "i");
      if (regex.test(name)) return true;
    } catch {
      // Skip invalid patterns - don't break execution
    }
  }
  return false;
}

/**
 * Create helper function to check protected variables
 */
function createProtectedVariableChecker(context: BuiltinToolContext) {
  return (name: string): { error: string; message: string } | null => {
    const exactMatches = context.security?.protectedVariables ?? [];
    const patterns = context.security?.protectedPatterns ?? [];
    if (isVariableProtected(name, exactMatches, patterns)) {
      return { error: "Access denied", message: `Variable '${name}' is protected` };
    }
    return null;
  };
}

// =============================================================================
// JOURNEY VARIABLE TOOL
// =============================================================================

/**
 * Create read_journey_variable tool
 *
 * Reads journey-scoped variables that exist only for this journey execution.
 */
export const createJourneyVariableTool: ToolFactory = (context) => {
  const checkProtected = createProtectedVariableChecker(context);

  return {
    name: SYSTEM_TOOL_NAMES.READ_JOURNEY_VARIABLE,
    description: "Read a journey-scoped variable. These variables are specific to this journey execution. Returns the current value or null if not set.",
    schema: z
      .object({
        name: z.string().describe("The journey variable name to read"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      variables: { read: ["journey"] },
      actions: ["variableRead"],
    },
    // Fixed immediate - LLM needs variable value to use in response
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs variable value to use in response",
    },
    execute: async ({ name }) => {
      // Check protected variables
      const protectedError = checkProtected(name);
      if (protectedError) {
        context.log.warn({ name, nodeId: context.nodeId }, "agent:tool:readJourneyVariable:protected");
        return protectedError;
      }

      try {
        const variables = await context.services.variable.getAll("journey");
        const value = variables[name];
        context.log.debug({ name, hasValue: value !== undefined && value !== null }, "agent:tool:readJourneyVariable");
        return { name, value };
      } catch (error) {
        context.log.error({ err: serializeError(error), name }, "agent:tool:readJourneyVariable:failed");
        return { error: "Read failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// USER VARIABLE TOOL
// =============================================================================

/**
 * Create read_user_variable tool
 *
 * Reads user profile variables that persist across interactions.
 */
export const createUserVariableTool: ToolFactory = (context) => {
  const checkProtected = createProtectedVariableChecker(context);

  return {
    name: SYSTEM_TOOL_NAMES.READ_USER_VARIABLE,
    description: "Read a user profile variable that persists across interactions. These variables are tied to the user and follow them across all journeys.",
    schema: z
      .object({
        name: z.string().describe("The user variable name to read"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      variables: { read: ["user"] },
      actions: ["variableRead"],
    },
    // Fixed immediate - LLM needs variable value to use in response
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs variable value to use in response",
    },
    execute: async ({ name }) => {
      // Check protected variables
      const protectedError = checkProtected(name);
      if (protectedError) {
        context.log.warn({ name, nodeId: context.nodeId }, "agent:tool:readUserVariable:protected");
        return protectedError;
      }

      try {
        const variables = await context.services.variable.getAll("user");
        const value = variables[name];
        context.log.debug({ name, hasValue: value !== undefined && value !== null }, "agent:tool:readUserVariable");
        return { name, value };
      } catch (error) {
        context.log.error({ err: serializeError(error), name }, "agent:tool:readUserVariable:failed");
        return { error: "Read failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// WRITE JOURNEY VARIABLE TOOL
// =============================================================================

/**
 * Create write_journey_variable tool
 *
 * Writes journey-scoped variables that exist only for this journey execution.
 */
export const createWriteJourneyVariableTool: ToolFactory = (context) => {
  const checkProtected = createProtectedVariableChecker(context);

  return {
    name: SYSTEM_TOOL_NAMES.WRITE_JOURNEY_VARIABLE,
    description: "Write a journey-scoped variable. These variables are specific to this journey execution and will be reset when the journey ends.",
    schema: z
      .object({
        name: z.string().describe("The variable name to write"),
        value: z.unknown().describe("The value to set (string, number, boolean, object, or array)"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      variables: { write: ["journey"] },
      actions: ["variableWrite"],
    },
    // Default immediate (read-after-write safety), but configurable
    timingConfig: {
      timing: "immediate",
      configurable: true,
    },
    execute: async ({ name, value }) => {
      // Check protected variables
      const protectedError = checkProtected(name);
      if (protectedError) {
        context.log.warn({ name, nodeId: context.nodeId }, "agent:tool:writeJourneyVariable:protected");
        return protectedError;
      }

      try {
        if (!context.services.variable.setValue) {
          return { error: "Not supported", message: "Variable write not available" };
        }
        await context.services.variable.setValue("journey", name, value);
        context.log.debug({ name }, "agent:tool:writeJourneyVariable:success");
        return { success: true, name, value };
      } catch (error) {
        context.log.error({ err: serializeError(error), name }, "agent:tool:writeJourneyVariable:failed");
        return { error: "Write failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// WRITE USER VARIABLE TOOL
// =============================================================================

/**
 * Create write_user_variable tool
 *
 * Writes user profile variables that persist across interactions.
 */
export const createWriteUserVariableTool: ToolFactory = (context) => {
  const checkProtected = createProtectedVariableChecker(context);

  return {
    name: SYSTEM_TOOL_NAMES.WRITE_USER_VARIABLE,
    description: "Write a user profile variable that persists across interactions. These variables are tied to the user and follow them across all journeys.",
    schema: z
      .object({
        name: z.string().describe("The variable name to write"),
        value: z.unknown().describe("The value to set (string, number, boolean, object, or array)"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      variables: { write: ["user"] },
      actions: ["variableWrite"],
    },
    // Default immediate (read-after-write safety), but configurable
    timingConfig: {
      timing: "immediate",
      configurable: true,
    },
    execute: async ({ name, value }) => {
      // Check protected variables
      const protectedError = checkProtected(name);
      if (protectedError) {
        context.log.warn({ name, nodeId: context.nodeId }, "agent:tool:writeUserVariable:protected");
        return protectedError;
      }

      try {
        if (!context.services.variable.setValue) {
          return { error: "Not supported", message: "Variable write not available" };
        }
        await context.services.variable.setValue("user", name, value);
        context.log.debug({ name }, "agent:tool:writeUserVariable:success");
        return { success: true, name, value };
      } catch (error) {
        context.log.error({ err: serializeError(error), name }, "agent:tool:writeUserVariable:failed");
        return { error: "Write failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// MINDSTATE PARAMETER TOOL
// =============================================================================

/**
 * Create read_mindstate_parameter tool
 *
 * Reads parameters from mindstate flows that track user progress.
 */
export const createMindstateParameterTool: ToolFactory = (context) => {
  const checkProtected = createProtectedVariableChecker(context);

  return {
    name: SYSTEM_TOOL_NAMES.READ_MINDSTATE_PARAMETER,
    description:
      "Read a parameter from a mindstate flow. Mindstates track user progress through defined conversation flows like onboarding, qualification, or support.",
    schema: z
      .object({
        mindstate: z.string().describe("The mindstate key (e.g., 'onboarding', 'qualification')"),
        parameter: z.string().describe("The parameter name within the mindstate (e.g., 'currentStep', 'score')"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      variables: { read: ["user"] }, // Mindstate parameters are user-scoped
      actions: ["variableRead"],
    },
    // Fixed immediate - LLM needs parameter value to use in response
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs parameter value to use in response",
    },
    execute: async ({ mindstate, parameter }) => {
      // Check protected variables (on both mindstate key and parameter)
      const protectedMindstate = checkProtected(mindstate);
      if (protectedMindstate) {
        context.log.warn({ mindstate, parameter, nodeId: context.nodeId }, "agent:tool:readMindstateParameter:protected");
        return protectedMindstate;
      }
      const protectedParam = checkProtected(parameter);
      if (protectedParam) {
        context.log.warn({ mindstate, parameter, nodeId: context.nodeId }, "agent:tool:readMindstateParameter:protected");
        return protectedParam;
      }

      if (!context.services.mindstate) {
        context.log.warn({ mindstate, parameter }, "agent:tool:readMindstateParameter:serviceNotAvailable");
        return { error: "Not available", message: "Mindstate service is not configured" };
      }

      try {
        const clientId = context.clientData?.id ?? context.session.userId;
        const value = await context.services.mindstate.getParameterValue(clientId, mindstate, parameter);
        context.log.debug({ mindstate, parameter, hasValue: value !== null }, "agent:tool:readMindstateParameter");
        return { mindstate, parameter, value };
      } catch (error) {
        context.log.error({ err: serializeError(error), mindstate, parameter }, "agent:tool:readMindstateParameter:failed");
        return { error: "Read failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Build all variable tools based on configuration
 *
 * @param context - Built-in tool context
 * @param config - Which tools to enable
 * @returns Array of enabled variable tools
 */
export function buildVariableTools(
  context: BuiltinToolContext,
  config: {
    readJourneyVariables?: boolean;
    readUserVariables?: boolean;
    readMindstateParameters?: boolean;
    writeJourneyVariables?: boolean;
    writeUserVariables?: boolean;
  }
): AgentTool[] {
  const tools: AgentTool[] = [];

  if (config.readJourneyVariables) {
    tools.push(createJourneyVariableTool(context));
  }
  if (config.readUserVariables) {
    tools.push(createUserVariableTool(context));
  }
  if (config.readMindstateParameters) {
    tools.push(createMindstateParameterTool(context));
  }
  if (config.writeJourneyVariables) {
    tools.push(createWriteJourneyVariableTool(context));
  }
  if (config.writeUserVariables) {
    tools.push(createWriteUserVariableTool(context));
  }

  return tools;
}
