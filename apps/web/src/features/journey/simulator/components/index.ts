/**
 * Simulator Components
 *
 * @module features/simulator/components
 */

// Chat components
// Note: PlaybackState comes from store (single source of truth), not from chat/types
export {
  JourneyChat,
  ChatBubble,
  ChatInput,
  NoChatMessages,
  WaitingForUserIndicator,
  ProcessingIndicator,
  type JourneyChatProps,
  type JourneyChatMessage,
  type ChatState,
  type ChatBubbleProps,
  type ChatInputProps,
  type ActiveTimer,
} from "./chat";

// Control components
export { PlaybackControls, TimerDisplay, SimulatorControls } from "./controls";

// Console components
export { EventLogPanel, ConsolePanelContainer } from "./console";
