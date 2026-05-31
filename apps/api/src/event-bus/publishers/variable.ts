/**
 * Variable Event Publishers
 *
 * Variable-related event publishers using the factory pattern.
 *
 * @module events/publishers/variable
 */

import { EventTypes } from "@journey/schemas";
import { createEventPublisher } from "../publisher-factory";

// =============================================================================
// VARIABLE EVENTS
// =============================================================================

export const publishVariableChanged = createEventPublisher(EventTypes.VARIABLE_CHANGED);

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

/**
 * All variable publishers as a single object
 *
 * @example
 * import { variable } from "./publishers";
 * await variable.changed(ctx, data);
 */
export const variable = {
  changed: publishVariableChanged,
} as const;
