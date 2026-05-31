/**
 * State Change Applier
 *
 * Applies StateChange commands to the simulator store.
 * Decouples pure event handlers from store actions.
 * Single responsibility: translate commands to store mutations.
 *
 * @module features/simulator/lib/state-change-applier
 */

import { createLogger } from "@journey/logger";
import type { JourneyMessage, EnhancedUserJourney, InteractionEvent } from "@journey/schemas";

import { simulatorActions, simulatorStore } from "../store";
import type { StateChange } from "./event-handlers";

const log = createLogger("state-change-applier");

/**
 * Apply a batch of state changes to the simulator store
 * Each change is applied in sequence using the appropriate store action
 *
 * @param changes - Array of state change commands to apply
 */
export function applyStateChanges(changes: StateChange[]): void {
  for (const change of changes) {
    switch (change.type) {
      case "set_timer": {
        const timerData = change.payload as {
          id: string;
          durationMs: number;
          startTime: number;
        };
        simulatorActions.setActiveTimer(timerData);
        break;
      }

      case "clear_timer": {
        simulatorActions.setActiveTimer(null);
        break;
      }

      case "add_event": {
        const event = change.payload as InteractionEvent;
        simulatorActions.addEvent(event);
        break;
      }

      case "add_message": {
        const messageData = change.payload as {
          message: JourneyMessage;
          from: "bot" | "user";
        };
        simulatorActions.addMessage(messageData.message, messageData.from);
        break;
      }

      case "update_session": {
        const currentSession = simulatorStore.state.session;
        if (currentSession) {
          const updates = change.payload as Partial<EnhancedUserJourney>;
          simulatorActions.updateSession({
            ...currentSession,
            ...updates,
          });
        } else {
          log.warn({}, "stateChangeApplier:noSessionToUpdate");
        }
        break;
      }

      default: {
        // Exhaustiveness check - TypeScript will error if a case is missing
        const _exhaustiveCheck: never = change.type;
        return _exhaustiveCheck;
      }
    }
  }
}
