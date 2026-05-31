/**
 * Event Publishers
 *
 * Domain-specific event publishers for all event types.
 *
 * @module events/publishers
 *
 * @example
 * import { publishers } from "../../event-bus";
 *
 * // CRM events
 * await publishers.crm.stageChanged(ctx, { pipelineId, ... });
 *
 * // Journey events
 * await publishers.journey.sessionStarted(ctx, { ... });
 *
 * // Interaction events
 * await publishers.interaction.userMessage(ctx, { text, ... });
 */

// Domain-specific publishers
export { crm } from "./crm";
export { journey } from "./journey";
export { bot } from "./bot";
export { tag } from "./tag";
export { variable } from "./variable";
export { interaction } from "./interaction";
export { workflow } from "./workflow";
export { mindstate } from "./mindstate";

// Import for unified object
import { crm } from "./crm";
import { journey } from "./journey";
import { bot } from "./bot";
import { tag } from "./tag";
import { variable } from "./variable";
import { interaction } from "./interaction";
import { workflow } from "./workflow";
import { mindstate } from "./mindstate";

/**
 * All publishers organized by domain
 */
export const publishers = {
  crm,
  journey,
  bot,
  tag,
  variable,
  interaction,
  workflow,
  mindstate,
} as const;

// Re-export factory and types
export {
  createEventPublisher,
  createBatchPublisher,
  type OrgContext,
  type ClientContext,
  type SessionContext,
  type ContextForEvent,
  type PayloadDataForEvent,
} from "../publisher-factory";
