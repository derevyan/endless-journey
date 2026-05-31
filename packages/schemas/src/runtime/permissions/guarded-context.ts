/**
 * Guarded Service Context
 *
 * Wraps SharedServiceContext with automatic permission checks.
 * All service method calls are validated against the subject's capabilities.
 *
 * @module permissions/guarded-context
 */

import type { SharedServiceContext, OptionalServiceName } from "../services/shared-context";
import type { IVariableService } from "../services/variable-service";
import type { IMessengerService } from "../services/messenger-service";
import type { IMemoryService } from "../services/memory-service";
import type { ICrmService } from "../services/crm-service";
import type { ITagService } from "../services/tag-service";
import type { ITemplateService } from "../services/template-service";
import type { VariableScope, VariableOperation } from "../../variables";
import type { VariableAction } from "../../nodes";
import type { PermissionSubject } from "./subjects";
import type { CapabilityDeclaration } from "./capabilities";
import { PermissionChecker, PermissionDeniedError } from "./checker";
import type { VariableScopePermission } from "./resources";

// =============================================================================
// GUARDED VARIABLE SERVICE
// =============================================================================

/**
 * Create a guarded variable service that checks permissions on every operation.
 */
function createGuardedVariableService(
  original: IVariableService,
  checker: PermissionChecker
): IVariableService {
  return {
    getAll: async (scope: VariableScope) => {
      checker.checkVariableRead(scope as VariableScopePermission);
      return original.getAll(scope);
    },

    executeAction: async (action: VariableAction) => {
      // Check write permission for each scope that has operations
      if (action.journeyOperations?.length) {
        checker.checkVariableWrite("journey");
      }
      if (action.globalOperations?.length) {
        checker.checkVariableWrite("global");
      }
      if (action.userOperations?.length) {
        checker.checkVariableWrite("user");
      }
      return original.executeAction(action);
    },

    getValue: original.getValue
      ? async (scope: VariableScope, key: string) => {
          checker.checkVariableRead(scope as VariableScopePermission);
          return original.getValue!(scope, key);
        }
      : undefined,

    setValue: original.setValue
      ? async (scope: VariableScope, key: string, value: unknown) => {
          checker.checkVariableWrite(scope as VariableScopePermission);
          return original.setValue!(scope, key, value);
        }
      : undefined,

    executeOperation: original.executeOperation
      ? async (scope: VariableScope, operation: VariableOperation) => {
          checker.checkVariableWrite(scope as VariableScopePermission);
          return original.executeOperation!(scope, operation);
        }
      : undefined,

    delete: original.delete
      ? async (scope: VariableScope, key: string) => {
          checker.checkVariableWrite(scope as VariableScopePermission);
          checker.checkAction("variableDelete");
          return original.delete!(scope, key);
        }
      : undefined,

    exists: original.exists
      ? async (scope: VariableScope, key: string) => {
          checker.checkVariableRead(scope as VariableScopePermission);
          return original.exists!(scope, key);
        }
      : undefined,
  };
}

// =============================================================================
// GUARDED MESSENGER SERVICE
// =============================================================================

/**
 * Create a guarded messenger service.
 */
function createGuardedMessengerService(
  original: IMessengerService,
  checker: PermissionChecker
): IMessengerService {
  return {
    sendMessage: async (...args: Parameters<IMessengerService["sendMessage"]>) => {
      checker.checkAction("sendMessage");
      return original.sendMessage(...args);
    },

    sendButtons: original.sendButtons
      ? async (...args: Parameters<NonNullable<IMessengerService["sendButtons"]>>) => {
          checker.checkAction("sendButtons");
          return original.sendButtons!(...args);
        }
      : undefined,

    sendMedia: original.sendMedia
      ? async (...args: Parameters<NonNullable<IMessengerService["sendMedia"]>>) => {
          checker.checkAction("sendMedia");
          return original.sendMedia!(...args);
        }
      : undefined,
  };
}

// =============================================================================
// GUARDED MEMORY SERVICE
// =============================================================================

/**
 * Create a guarded memory service.
 */
function createGuardedMemoryService(
  original: IMemoryService,
  checker: PermissionChecker
): IMemoryService {
  return {
    // Required methods
    save: async (params) => {
      checker.checkAction("saveMemory");
      return original.save(params);
    },

    search: async (query, limit) => {
      checker.checkAction("searchMemory");
      return original.search(query, limit);
    },

    getRecent: async (limit) => {
      checker.checkAction("searchMemory");
      return original.getRecent(limit);
    },

    get: async (key) => {
      checker.checkAction("searchMemory");
      return original.get(key);
    },

    delete: async (key) => {
      checker.checkAction("deleteMemory");
      return original.delete(key);
    },

    // Optional methods
    exists: original.exists
      ? async (key) => {
          checker.checkAction("searchMemory");
          return original.exists!(key);
        }
      : undefined,

    getAll: original.getAll
      ? async () => {
          checker.checkAction("searchMemory");
          return original.getAll!();
        }
      : undefined,

    clear: original.clear
      ? async () => {
          checker.checkAction("deleteMemory");
          return original.clear!();
        }
      : undefined,
  };
}

// =============================================================================
// GUARDED CRM SERVICE
// =============================================================================

/**
 * Create a guarded CRM service with granular per-action permission checks.
 */
function createGuardedCrmService(
  original: ICrmService,
  checker: PermissionChecker
): ICrmService {
  return {
    // Required method
    updateClientPosition: async (clientId, pipelineId, stageId, notes) => {
      checker.checkAction("crmMoveToStage");
      return original.updateClientPosition(clientId, pipelineId, stageId, notes);
    },

    // Optional pipeline management methods
    addToPipeline: original.addToPipeline
      ? async (clientId, pipelineId, stageId, notes) => {
          checker.checkAction("crmAddToPipeline");
          return original.addToPipeline!(clientId, pipelineId, stageId, notes);
        }
      : undefined,

    removeFromPipeline: original.removeFromPipeline
      ? async (clientId, pipelineId) => {
          checker.checkAction("crmRemoveFromPipeline");
          return original.removeFromPipeline!(clientId, pipelineId);
        }
      : undefined,

    moveToStage: original.moveToStage
      ? async (clientId, stageId, notes) => {
          checker.checkAction("crmMoveToStage");
          return original.moveToStage!(clientId, stageId, notes);
        }
      : undefined,

    updatePosition: original.updatePosition
      ? async (userId, pipelineId, position) => {
          checker.checkAction("crmUpdatePosition");
          return original.updatePosition!(userId, pipelineId, position);
        }
      : undefined,

    // Deal management
    setDealValue: original.setDealValue
      ? async (userId, pipelineId, value, currency) => {
          checker.checkAction("crmSetDealValue");
          return original.setDealValue!(userId, pipelineId, value, currency);
        }
      : undefined,

    assignOwner: original.assignOwner
      ? async (userId, pipelineId, ownerId) => {
          checker.checkAction("crmAssignOwner");
          return original.assignOwner!(userId, pipelineId, ownerId);
        }
      : undefined,

    // Contact management
    updateContact: original.updateContact
      ? async (userId, contactData) => {
          checker.checkAction("crmUpdateContact");
          return original.updateContact!(userId, contactData);
        }
      : undefined,

    createNote: original.createNote
      ? async (userId, content, metadata) => {
          checker.checkAction("crmCreateNote");
          return original.createNote!(userId, content, metadata);
        }
      : undefined,

    // Read operations (no permission checks - read only)
    getPipelines: original.getPipelines
      ? async () => original.getPipelines!()
      : undefined,

    getUserPipeline: original.getUserPipeline
      ? async (userId, pipelineId) => original.getUserPipeline!(userId, pipelineId)
      : undefined,

    getUserPipelines: original.getUserPipelines
      ? async (userId) => original.getUserPipelines!(userId)
      : undefined,

    getStages: original.getStages
      ? async (pipelineId) => original.getStages!(pipelineId)
      : undefined,

    getDefaultPipeline: original.getDefaultPipeline
      ? async () => original.getDefaultPipeline!()
      : undefined,

    getNotes: original.getNotes
      ? async (userId, limit) => original.getNotes!(userId, limit)
      : undefined,
  };
}

// =============================================================================
// GUARDED TAG SERVICE
// =============================================================================

/**
 * Create a guarded tag service.
 */
function createGuardedTagService(
  original: ITagService,
  checker: PermissionChecker
): ITagService {
  return {
    // Required method
    executeTagAction: async (add?: string[], remove?: string[]) => {
      if (add?.length) {
        checker.checkAction("addTag");
      }
      if (remove?.length) {
        checker.checkAction("removeTag");
      }
      return original.executeTagAction(add, remove);
    },

    // Required method - read only
    getTags: async () => {
      checker.checkAction("getTags");
      return original.getTags();
    },

    // Optional methods
    addTags: original.addTags
      ? async (tags: string[]) => {
          checker.checkAction("addTag");
          return original.addTags!(tags);
        }
      : undefined,

    removeTags: original.removeTags
      ? async (tags: string[]) => {
          checker.checkAction("removeTag");
          return original.removeTags!(tags);
        }
      : undefined,

    executeAction: original.executeAction
      ? async (...args: Parameters<NonNullable<ITagService["executeAction"]>>) => {
          checker.checkAction("addTag");
          checker.checkAction("removeTag");
          return original.executeAction!(...args);
        }
      : undefined,

    hasTag: original.hasTag
      ? async (tag: string) => {
          checker.checkAction("getTags");
          return original.hasTag!(tag);
        }
      : undefined,

    hasAllTags: original.hasAllTags
      ? async (tags: string[]) => {
          checker.checkAction("getTags");
          return original.hasAllTags!(tags);
        }
      : undefined,

    hasAnyTag: original.hasAnyTag
      ? async (tags: string[]) => {
          checker.checkAction("getTags");
          return original.hasAnyTag!(tags);
        }
      : undefined,

    setTags: original.setTags
      ? async (tags: string[]) => {
          checker.checkAction("addTag");
          checker.checkAction("removeTag");
          return original.setTags!(tags);
        }
      : undefined,

    clearTags: original.clearTags
      ? async () => {
          checker.checkAction("removeTag");
          return original.clearTags!();
        }
      : undefined,

    getAllAvailableTags: original.getAllAvailableTags
      ? async () => {
          // Read-only, no special permission needed
          return original.getAllAvailableTags!();
        }
      : undefined,
  };
}

// =============================================================================
// GUARDED CONTEXT FACTORY
// =============================================================================

/**
 * Options for creating a guarded context.
 */
export interface GuardedContextOptions {
  /** Callback when permission is denied */
  onPermissionDenied?: (error: PermissionDeniedError) => void;

  /** Whether to throw on permission denial (default: true) */
  throwOnDenied?: boolean;
}

/**
 * Create a guarded service context that wraps the original context
 * with automatic permission checks on all service methods.
 *
 * @param original - The original SharedServiceContext to wrap
 * @param subject - The permission subject making requests
 * @param capabilities - The capabilities granted to the subject
 * @param options - Configuration options
 * @returns A guarded SharedServiceContext
 *
 * @example
 * ```typescript
 * import { createGuardedContext, CapabilityProfiles, createLlmToolSubject } from "@journey/schemas/permissions";
 *
 * // Create a guarded context for an LLM tool
 * const subject = createLlmToolSubject({ toolId: "save_memory", sessionId: "..." });
 * const guardedContext = createGuardedContext(
 *   originalContext,
 *   subject,
 *   CapabilityProfiles.LLM_TOOL_STANDARD
 * );
 *
 * // Now all service calls are permission-checked
 * await guardedContext.variable.setValue("journey", "key", "value"); // OK
 * await guardedContext.variable.setValue("global", "key", "value"); // Throws PermissionDeniedError
 * ```
 */
export function createGuardedContext(
  original: SharedServiceContext,
  subject: PermissionSubject,
  capabilities: CapabilityDeclaration,
  options: GuardedContextOptions = {}
): SharedServiceContext {
  const checker = new PermissionChecker(subject, capabilities, {
    throwOnDenied: options.throwOnDenied ?? true,
    onCheck: (_, resource, result) => {
      if (!result.allowed && options.onPermissionDenied) {
        options.onPermissionDenied(
          new PermissionDeniedError(subject, resource, result.reason ?? "Permission denied")
        );
      }
    },
  });

  // Wrap core services
  const guardedVariable = createGuardedVariableService(original.variable, checker);
  const guardedMessenger = createGuardedMessengerService(original.messenger, checker);

  // Template service doesn't need permission checks (read-only transformation)
  const guardedTemplate: ITemplateService = original.template;

  // Wrap optional services (only if present)
  const guardedMemory = original.memory
    ? createGuardedMemoryService(original.memory, checker)
    : undefined;

  const guardedCrm = original.crm
    ? createGuardedCrmService(original.crm, checker)
    : undefined;

  const guardedTag = original.tag
    ? createGuardedTagService(original.tag, checker)
    : undefined;

  // Create the guarded context
  const guardedContext: SharedServiceContext = {
    // Core services
    variable: guardedVariable,
    template: guardedTemplate,
    messenger: guardedMessenger,

    // Optional services (wrapped if present)
    memory: guardedMemory,
    crm: guardedCrm,
    tag: guardedTag,

    // Pass through other optional services (can be wrapped if needed)
    mindstate: original.mindstate,
    dlq: original.dlq,
    expression: original.expression,
    followUp: original.followUp,

    // Availability check
    has: (service: OptionalServiceName) => original.has(service),
  };

  return guardedContext;
}

/**
 * Check if a context is guarded (has permission enforcement).
 * Useful for debugging and testing.
 */
export function isGuardedContext(_context: SharedServiceContext): boolean {
  // In a full implementation, we'd mark guarded contexts with a symbol
  // For now, this is a placeholder
  return false;
}

/**
 * Get the permission checker from a guarded context.
 * Returns undefined for unguarded contexts.
 */
export function getPermissionChecker(_context: SharedServiceContext): PermissionChecker | undefined {
  // In a full implementation, we'd store the checker on the context
  // For now, this is a placeholder
  return undefined;
}
