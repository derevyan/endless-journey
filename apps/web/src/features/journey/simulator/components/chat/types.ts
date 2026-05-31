/**
 * Chat Component Types
 *
 * @module features/simulator/components/chat/types
 */

import type { JourneyMessage } from "@journey/schemas";

// Import shared types from store (single source of truth)
import type { ChatState, PlaybackState } from "../../store";

// Re-export for convenience
export type { ChatState, PlaybackState };

// Import and re-export NodeWithButtons from session-replay (single source of truth)
import type { NodeWithButtons } from "../../lib/session-replay";
export type { NodeWithButtons };

export interface JourneyChatMessage {
  id: string;
  message: JourneyMessage;
  timestamp: Date;
  from: "bot" | "user";
}

export interface ActiveTimer {
  id: string;
  durationMs: number;
  onSkip: () => void;
}

/**
 * JourneyChatProps - Simplified props for JourneyChat component.
 *
 * Most simulator state comes from SimulatorContext.
 * These props are for UI controls managed by the parent component.
 */
export interface JourneyChatProps {
  /** Callback to reset/stop the chat session */
  onReset?: () => void;
  /** Whether console panel is visible */
  showConsole?: boolean;
  /** Toggle console panel visibility */
  onToggleConsole?: () => void;
  /** Journey nodes for button label lookup in playback mode */
  nodes?: NodeWithButtons[];
}

export interface ChatBubbleProps {
  content?: string;
  buttons?: JourneyMessage["buttons"];
  media?: JourneyMessage["media"];
  timestamp: Date;
  isBot: boolean;
  isAction?: boolean;
  onButtonClick: (buttonId: string) => void;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  isProcessing: boolean;
  isCompleted: boolean;
}
