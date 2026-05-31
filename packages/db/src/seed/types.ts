/**
 * Shared types for seed modules
 *
 * @module seed/types
 */

import type { JourneyConfig, WorkflowConfiguration } from "@journey/schemas";

// =============================================================================
// JOURNEY CONFIGS
// =============================================================================

export interface JourneyConfigData {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: "active" | "draft";
  configuration: JourneyConfig;
}

// =============================================================================
// WORKFLOW CONFIGS
// =============================================================================

export interface WorkflowConfigData {
  id: string;
  key: string;
  name: string;
  description: string;
  status: "draft" | "active";
  configuration: WorkflowConfiguration;
}

// =============================================================================
// PROMPT CONFIGS
// =============================================================================

export interface PromptConfigData {
  name: string;
  description: string;
  type: "text" | "chat";
  tags: string[];
  isSystem: boolean;
  scope: "global" | "ecu";
}

// =============================================================================
// USER DATA
// =============================================================================

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

export interface UserOrgAssignment {
  orgName: string;
  journeyIds: string[];
}

// =============================================================================
// CLIENT DATA
// =============================================================================

export interface TestChannelUser {
  id: string;
  platformUserId: string;
  platform: "telegram" | "whatsapp" | "simulator";
  firstName: string;
  lastName: string | null;
  username: string;
  userVars: Record<string, unknown>;
}

// =============================================================================
// SESSION DATA
// =============================================================================

export interface TestSession {
  id: string;
  clientId: string;
  currentNodeId: string;
  status: "active" | "completed" | "dropped" | "paused" | "error";
}

// =============================================================================
// INTERACTION DATA
// =============================================================================

export type InteractionType =
  | "user.message"
  | "user.click"
  | "system.message"
  | "system.transition"
  | "system.timeout"
  | "system.error"
  // Engine events (for state reconstruction in playback mode)
  | "engine.transition"
  | "engine.message"
  | "session.variables"
  | "session.tags";

export interface TestInteraction {
  type: InteractionType;
  nodeId: string;
  payload: Record<string, unknown>;
  offsetMinutes: number;
}

// =============================================================================
// CRM DATA
// =============================================================================

export interface PipelineStageData {
  name: string;
  color: string;
  position: number;
  isDefault: boolean;
  isSystem: boolean;
}

// =============================================================================
// TAG DATA
// =============================================================================

export interface TagDefinitionData {
  tag: string;
  description: string;
  color: string;
}

// =============================================================================
// VARIABLE DATA
// =============================================================================

export interface VariableData {
  key: string;
  value: unknown;
  description: string;
}
