/**
 * Workflow Node Definitions Bootstrap
 *
 * Import all node definition modules to trigger self-registration.
 * Each import causes the node to register itself with workflowNodeRegistry.
 *
 * When adding a new node type, add an import here:
 * import "./{node-name}";
 *
 * @module features/nodes/workflow/definitions/index
 */

// Core nodes
import "./start";
import "./end";

// Tool nodes
import "./agent";
import "./guard";
import "./context";
import "./mcp";
import "./question-understanding";

// Logic nodes
import "./if-else";
import "./user-approval";

// Data nodes
import "./transform";
import "./set-state";

// Re-export registry for convenience
export { workflowNodeRegistry } from "../registry/workflow-node-registry";
