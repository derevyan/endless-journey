/**
 * Chat Components
 *
 * @module features/simulator/components/chat
 */

export { JourneyChat } from "./journey-chat";
export { ChatBubble } from "./chat-bubble";
export { ChatInput } from "./chat-input";
export { NoChatMessages, WaitingForUserIndicator, ProcessingIndicator } from "./chat-state-indicators";

// Type exports - Note: PlaybackState is imported from store in types.ts (single source of truth)
export type {
  JourneyChatProps,
  JourneyChatMessage,
  ChatState,
  ChatBubbleProps,
  ChatInputProps,
  ActiveTimer,
} from "./types";
