/**
 * Mindstate Event Publishers
 *
 * All mindstate definition-related event publishers using the factory pattern.
 *
 * @module events/publishers/mindstate
 */

import { EventTypes } from "@journey/schemas";
import { createEventPublisher } from "../publisher-factory";

// =============================================================================
// DEFINITION LIFECYCLE EVENTS
// =============================================================================

export const publishMindstateDefinitionCreated = createEventPublisher(EventTypes.MINDSTATE_DEFINITION_CREATED);
export const publishMindstateDefinitionUpdated = createEventPublisher(EventTypes.MINDSTATE_DEFINITION_UPDATED);
export const publishMindstateDefinitionDeleted = createEventPublisher(EventTypes.MINDSTATE_DEFINITION_DELETED);

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

/**
 * All mindstate publishers as a single object
 *
 * @example
 * import { mindstate } from "./publishers";
 * await mindstate.definitionCreated(ctx, data);
 */
export const mindstate = {
  definitionCreated: publishMindstateDefinitionCreated,
  definitionUpdated: publishMindstateDefinitionUpdated,
  definitionDeleted: publishMindstateDefinitionDeleted,
} as const;
