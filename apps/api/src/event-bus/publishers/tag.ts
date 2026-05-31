/**
 * Tag Event Publishers
 *
 * All tag-related event publishers using the factory pattern.
 *
 * @module events/publishers/tag
 */

import { EventTypes } from "@journey/schemas";
import { createEventPublisher } from "../publisher-factory";

// =============================================================================
// TAG EVENTS (Journey Context)
// =============================================================================

export const publishJourneyTagAdded = createEventPublisher(EventTypes.TAG_ADDED);
export const publishJourneyTagRemoved = createEventPublisher(EventTypes.TAG_REMOVED);

// =============================================================================
// TAG DEFINITION EVENTS
// =============================================================================

export const publishTagDefinitionCreated = createEventPublisher(EventTypes.TAG_DEFINITION_CREATED);
export const publishTagDefinitionUpdated = createEventPublisher(EventTypes.TAG_DEFINITION_UPDATED);
export const publishTagDefinitionDeleted = createEventPublisher(EventTypes.TAG_DEFINITION_DELETED);

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

/**
 * All tag publishers as a single object
 *
 * @example
 * import { tag } from "./publishers";
 * await tag.added(ctx, data);
 */
export const tag = {
  // Tag operations (journey context)
  added: publishJourneyTagAdded,
  removed: publishJourneyTagRemoved,

  // Tag definition
  definitionCreated: publishTagDefinitionCreated,
  definitionUpdated: publishTagDefinitionUpdated,
  definitionDeleted: publishTagDefinitionDeleted,
} as const;
