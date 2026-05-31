/**
 * Mindstate Event Payloads
 *
 * Payload schemas for mindstate definition lifecycle events.
 *
 * @module schemas/events/payloads/mindstate
 */

import { z } from "zod";

// =============================================================================
// MINDSTATE DEFINITION CRUD EVENTS
// =============================================================================

/**
 * Payload for mindstate.definition.created event
 * Emitted when a new mindstate definition is created
 */
export const MindstateDefinitionCreatedPayloadSchema = z.object({
  definitionId: z.string(),
  definitionKey: z.string(),
  definitionName: z.string(),
  createdBy: z.string(),
});

export type MindstateDefinitionCreatedPayload = z.infer<typeof MindstateDefinitionCreatedPayloadSchema>;

/**
 * Payload for mindstate.definition.updated event
 * Emitted when a mindstate definition is updated
 */
export const MindstateDefinitionUpdatedPayloadSchema = z.object({
  definitionId: z.string(),
  definitionKey: z.string(),
  definitionName: z.string(),
  changes: z.record(z.string(), z.unknown()),
  updatedBy: z.string(),
});

export type MindstateDefinitionUpdatedPayload = z.infer<typeof MindstateDefinitionUpdatedPayloadSchema>;

/**
 * Payload for mindstate.definition.deleted event
 * Emitted when a mindstate definition is deleted
 */
export const MindstateDefinitionDeletedPayloadSchema = z.object({
  definitionId: z.string(),
  definitionKey: z.string(),
  definitionName: z.string(),
  deletedBy: z.string(),
});

export type MindstateDefinitionDeletedPayload = z.infer<typeof MindstateDefinitionDeletedPayloadSchema>;
