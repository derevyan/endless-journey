/**
 * Workflow Initialization
 *
 * Centralizes workflow executor registration to ensure it happens
 * exactly once during app startup.
 *
 * @module modules/workflows/init
 */

import { registerBuiltinExecutors } from "@journey/llm/workflow";
import { createLogger } from "@journey/logger";

const log = createLogger("workflow-init");

let initialized = false;

/**
 * Initialize workflow executors (idempotent).
 *
 * This function can be called multiple times safely - it will only
 * register executors on the first call. Call this once during app
 * startup in index.ts.
 *
 * Called once during server startup (apps/api/src/index.ts).
 *
 * This consolidation ensures single registration and clearer initialization.
 */
export function initWorkflowExecutors(): void {
  if (initialized) {
    return;
  }

  registerBuiltinExecutors();
  initialized = true;
  log.info({}, "workflowExecutors:registered");
}
