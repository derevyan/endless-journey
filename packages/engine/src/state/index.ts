/**
 * State Management Module
 *
 * Provides encapsulated state management for the journey engine.
 *
 * @module engine/state
 */

export {
  createSessionStateManager,
  SessionStateManager,
  type PendingTimer,
  type SessionStateManagerConfig,
  type SessionStatus,
  type StateUpdateResult,
} from "./session-state-manager";

export {
  AgentStateManager,
  createAgentStateManager,
  createDefaultAgentState,
  type WorkflowUsage,
} from "./agent-state-manager";

export {
  QuestionnaireStateManager,
  createQuestionnaireStateManager,
  createDefaultQuestionnaireState,
} from "./questionnaire-state-manager";
