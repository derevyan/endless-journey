/**
 * Notification Handler
 *
 * Shows toast notifications for events configured to notify users.
 * Uses the frontend event registry to determine when and what to show.
 *
 * @module lib/events/handlers/notifications
 */

import { createLogger, serializeError } from "@journey/logger";
import { EVENT_REGISTRY, type EventType } from "@journey/schemas";

import { notify } from "@/shared/lib/ui/notify";

import type { FrontendEvent, EventHandler } from "../types";
import { getEventConfig } from "../registry";
import { shouldNotify } from "../notification-policies";
import { HANDLER_PRIORITY } from "../types";

const log = createLogger("notification-handler");

// =============================================================================
// NOTIFICATION HANDLER
// =============================================================================

/**
 * Create a notification handler
 *
 * Two-stage filtering:
 * 1. Registry config check: Is this event type configured to notify? (notify: true/false)
 * 2. Policy check: Should this specific event be shown based on context? (admin vs system)
 *
 * @returns Event handler that shows toast notifications
 */
export function createNotificationHandler(): EventHandler {
  return (event: FrontendEvent) => {
    const config = getEventConfig(event.type);

    // Stage 1: Registry config check
    if (!config?.notify) {
      return;
    }

    // Stage 2: Notification policy check (context-aware filtering)
    if (!shouldNotify(event)) {
      log.debug(
        { eventType: event.type, performedBy: event.performedBy },
        "notification:filtered"
      );
      return;
    }

    try {
      // Get message from config or fall back to registry description
      const message =
        config.notifyMessage ||
        EVENT_REGISTRY[event.type as EventType]?.description ||
        event.type;

      const variant = config.notifyVariant || "info";

      log.debug(
        { eventType: event.type, variant, message, performedBy: event.performedBy },
        "notification:show"
      );

      // Show notification based on variant
      switch (variant) {
        case "success":
          notify.success(message);
          break;
        case "error":
          notify.error(message);
          break;
        case "warning":
          notify.warning(message);
          break;
        case "info":
        default:
          notify.info(message);
          break;
      }
    } catch (error) {
      log.error(
        { eventType: event.type, err: serializeError(error) },
        "notification:failed"
      );
    }
  };
}

/**
 * Handler config for notifications
 */
export const NOTIFICATION_CONFIG = {
  priority: HANDLER_PRIORITY.LOW,
} as const;
