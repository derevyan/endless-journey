/**
 * Routing Module
 *
 * Unified transition resolution for the journey engine.
 * Consolidates button, message, and timeout routing logic.
 */

export {
  // Core resolution functions
  resolveButtonClick,
  resolveMessage,
  resolveTimeout,
  // Handler helpers
  filterRoutableButtons,
  buildTransitionOptions,
  // Response type utilities
  getEffectiveResponseType,
  getNodeResponseType,
  // Types
  type TransitionResult,
  type TransitionReason,
  type TransitionOptions,
  type ActiveButtonInfo,
} from "./resolve-transition";
