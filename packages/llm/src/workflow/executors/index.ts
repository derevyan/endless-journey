/**
 * Executor Registration - Register all built-in node executors
 *
 * This module registers all node executors with the registry.
 * Call registerBuiltinExecutors() at application startup.
 */

import { createLogger } from "@journey/logger";
import { registerNodeExecutor } from "../executor-registry";

// Core executors
import { StartNodeExecutor } from "./core/start";
import { EndNodeExecutor } from "./core/end";
import { AgentNodeExecutor } from "./core/agent";

// Tool executors
import { GuardNodeExecutor } from "./tools/guard";
import { ContextNodeExecutor } from "./tools/context";
import { MCPNodeExecutor } from "./tools/mcp";
import { QuestionUnderstandingNodeExecutor } from "./tools/question-understanding";

// Logic executors
import { IfElseNodeExecutor } from "./logic/if-else";
import { UserApprovalNodeExecutor } from "./logic/user-approval";

// Data executors
import { TransformNodeExecutor } from "./data/transform";
import { SetStateNodeExecutor } from "./data/set-state";

const log = createLogger("llm:workflow:executors");

// ============================================================================
// IDEMPOTENT REGISTRATION GUARD
// ============================================================================

let builtinExecutorsRegistered = false;

/**
 * Register all built-in node executors.
 *
 * This function is idempotent - calling it multiple times has no effect
 * after the first call. This prevents duplicate registration when modules
 * are imported multiple times.
 *
 * Call this once at application startup.
 */
export function registerBuiltinExecutors(): void {
  if (builtinExecutorsRegistered) {
    log.debug({}, "workflow:executors:alreadyRegistered");
    return;
  }
  builtinExecutorsRegistered = true;
  // Core
  registerNodeExecutor("start", new StartNodeExecutor());
  registerNodeExecutor("end", new EndNodeExecutor());
  registerNodeExecutor("agent", new AgentNodeExecutor());
  // Note: 'note' nodes are not executed (informational only)

  // Tools
  registerNodeExecutor("guard", new GuardNodeExecutor());
  // Context executor disabled: throws NotImplementedError, implementation incomplete (F9)
  // registerNodeExecutor("context", new ContextNodeExecutor());
  registerNodeExecutor("mcp", new MCPNodeExecutor());
  registerNodeExecutor("question_understanding", new QuestionUnderstandingNodeExecutor());

  // Logic
  registerNodeExecutor("if_else", new IfElseNodeExecutor());
  registerNodeExecutor("user_approval", new UserApprovalNodeExecutor());

  // Data
  registerNodeExecutor("transform", new TransformNodeExecutor());
  registerNodeExecutor("set_state", new SetStateNodeExecutor());

  log.debug({}, "workflow:executors:registered");
}

// Re-export individual executors for direct use
export * from "./core";
export * from "./tools";
export * from "./logic";
export * from "./data";

// Export base executor for custom executors
export { BaseNodeExecutor } from "./base-executor";
