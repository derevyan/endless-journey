export { ApiEventService } from "./api-event-service";
export type { EventServiceContext } from "./service-context";

// Public API - explicit exports from event-service
export {
  listInteractionEvents,
  getEventStats,
  listEventTypes,
  listCrmEvents,
  listLlmEvents,
  getLlmStats,
  replayEvents,
  getLatestReplaySequence,
} from "./event-service";
