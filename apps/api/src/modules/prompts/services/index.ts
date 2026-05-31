/**
 * Prompt Services
 *
 * Re-export all prompt-related services.
 *
 * @module modules/prompts/services
 */

export { ApiPromptService } from "./api-prompt-service";
export type { PromptServiceContext } from "./service-context";

// Prompt CRUD operations
export {
  listPrompts,
  getPromptByName,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from "./prompt-service";

// Version management
export {
  listVersions,
  getVersion,
  getVersionByLabel,
  createVersion,
  updateLabels,
  deleteVersion,
} from "./version-service";

// Cached version access (for runtime/agent use)
export {
  getVersionByLabel as getCachedVersionByLabel,
  getVersion as getCachedVersion,
  createVersion as createVersionCached,
  updateLabels as updateLabelsCached,
  deleteVersion as deleteVersionCached,
  invalidatePromptCache,
  invalidateOrganizationPromptCache,
} from "./cached-service";

// Compile service (template resolution)
export {
  compilePrompt,
  compileTextPrompt,
  compileChatPrompt,
  extractVariables,
  extractVariablePaths,
  validateVariables,
} from "./compile-service";
