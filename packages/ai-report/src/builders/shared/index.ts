/**
 * Shared Builder Utilities
 *
 * @module @journey/ai-report/builders/shared
 */

export {
  truncateSystemPrompt,
  truncateInputMessages,
  applyLLMTruncationRules,
  type LLMInputMessage,
  type SystemPromptTruncationResult,
} from "./llm-truncation";

export {
  mapEventType,
  mapTrigger,
  mapButtonOutcomeToUnprocessed,
} from "./event-mappers";

export {
  groupLLMEventsByModule,
  sortLLMEventsByTimestamp,
  getLLMEventsForNode,
  findLLMEventByTimestamp,
} from "./llm-grouping";
