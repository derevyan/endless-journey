/**
 * Node System - Consolidated React Flow Node Infrastructure
 * @module nodes
 *
 * This module contains all node-related code for the journey editor:
 * - Type definitions (react-flow-types.ts)
 * - Node registry and self-registration system (registry/)
 * - Node UI components (components/)
 * - Edge components (edges/)
 * - Node editor panels (editors/)
 * - Form logic for node editors (forms/)
 * - Editor hooks (hooks/)
 * - Node utilities (utils/)
 * - Node-specific logic (logic/)
 * - Default configurations (config/)
 *
 * Bootstrap: import './types/index' to register all node types
 */

// Types
export * from "./react-flow-types";

// Registry
export * from "./registry/node-registry";

// Components
export * from "./components";

// Edges
export * from "./edges";

// Editors
export * from "./editors";

// Forms
export * from "./forms";

// Hooks
export * from "./hooks";

// Utils
export * from "./utils";

// Logic
export * from "./logic/wait";

// Config (createNode, createDefaultNodeData - generateNodeId is in utils)
export { createNode, createDefaultNodeData } from "./config/defaults";

// Bootstrap - must be imported to register nodes
import "./types/index";
