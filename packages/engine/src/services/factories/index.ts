/**
 * Service Factory Types
 *
 * Consolidated interfaces for service factory configuration.
 * These interfaces group related callbacks and options for cleaner code organization.
 */

import type { createLogger } from "@journey/logger";
import type { EnhancedUserJourney, InteractionEvent, JourneyConfig, VariableOperation, VariableScope } from "@journey/schemas";
import type { ClientData, CrmService, MindstateService, MessagingAdapter } from "../../types";

// =============================================================================
// CALLBACK INTERFACES
// =============================================================================

/**
 * Callbacks for event and interaction handling
 */
export interface EventCallbacks {
  onEvent?: (event: InteractionEvent) => void;
}

/**
 * Callbacks for tag operations
 */
export interface TagCallbacks {
  onTagOperation?: (userId: string, tags: { add?: string[]; remove?: string[] }) => Promise<void>;
  onGetTags?: (userId: string) => Promise<string[]>;
}

/**
 * Callbacks for variable operations
 */
export interface VariableCallbacks {
  onVariableOperation?: (scope: VariableScope, scopeId: string, operations: VariableOperation[]) => Promise<void>;
  onGetVariables?: (scope: VariableScope, scopeId: string) => Promise<Record<string, unknown>>;
  onUserVariableOperation?: (userId: string, operations: VariableOperation[]) => Promise<Record<string, unknown>>;
  onGetUserVariables?: (userId: string) => Promise<Record<string, unknown>>;
}

/**
 * Callback for message persistence
 */
export interface MessageCallbacks {
  onMessageSent?: (params: {
    sessionId: string;
    nodeId: string;
    platform: string;
    chatId: string;
    content: string;
    messages: string[];
  }) => Promise<void>;
}

/**
 * All service callbacks consolidated
 */
export interface ServiceCallbacks extends EventCallbacks, TagCallbacks, VariableCallbacks, MessageCallbacks {}

// =============================================================================
// CONFIGURATION INTERFACES
// =============================================================================

/**
 * Engine service options
 */
export interface ServiceOptions {
  organizationId: string | null;
  clientData: ClientData | null;
  defaultPipelineId: string | null;
  strictVariableOperations: boolean;
}

/**
 * External services that can be injected
 */
export interface ExternalServices {
  crmService?: CrmService;
  mindstateService?: MindstateService;
}

/**
 * Full service factory configuration
 */
export interface ServiceFactoryConfig {
  session: EnhancedUserJourney;
  journey: JourneyConfig;
  adapter: MessagingAdapter;
  log: ReturnType<typeof createLogger>;
  callbacks: ServiceCallbacks;
  options: ServiceOptions;
  externalServices: ExternalServices;
}
