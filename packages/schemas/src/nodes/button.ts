import { z } from "zod";
import { CONTENT_REF_PREFIX } from "../runtime/content";

/**
 * Button Configuration Schema
 *
 * Buttons are first-class entities with their own IDs.
 * Routing uses direct targetNodeId to specify the destination node.
 *
 * Managed Edge System:
 * - Buttons with targetNodeId have managed edges created for visualization
 * - Managed edges are stored in journey.edges and synced with button data
 * - Edge IDs follow pattern: managed-btn::{nodeId}::{buttonId}
 *
 * Benefits:
 * - Button text can change freely without breaking routing
 * - Fast ID-based lookup instead of string comparison
 * - Simpler data model (button → target directly)
 */
/** Max button text length - truncate longer text for Telegram compatibility */
const BUTTON_TEXT_MAX_LENGTH = 35;

export const ButtonConfigSchema = z.object({
  /** Unique button identifier, auto-generated on creation */
  id: z.string(),
  /** Display text shown to user. Auto-truncated to 35 chars for Telegram compatibility */
  text: z.string().transform((val) => {
    // Don't truncate content references - they'll be resolved later
    if (val.startsWith(CONTENT_REF_PREFIX)) {
      return val;
    }
    if (val.length > BUTTON_TEXT_MAX_LENGTH) {
      return val.slice(0, BUTTON_TEXT_MAX_LENGTH - 3) + "...";
    }
    return val;
  }),
  /**
   * Direct target node ID for routing.
   * Button routes directly to this node.
   * Managed edges are created for visualization from this field.
   */
  targetNodeId: z.string().optional(),
});

export type ButtonConfig = z.infer<typeof ButtonConfigSchema>;

/**
 * Array of button configurations
 * Max 100 buttons per message - Telegram inline keyboard limit
 */
export const ButtonsSchema = z.array(ButtonConfigSchema).max(100, "Maximum 100 buttons allowed");

export type Buttons = z.infer<typeof ButtonsSchema>;
