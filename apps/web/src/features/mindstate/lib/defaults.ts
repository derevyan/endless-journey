/**
 * Default Configuration for MindState Builder
 *
 * Re-exports core defaults from @journey/schemas and adds UI-specific constants.
 */

// Re-export core defaults from schemas (single source of truth)
export {
  DEFAULT_CATEGORIES,
  DEFAULT_MAIN_AGENT,
  DEFAULT_STATE_PARAMETERS as DEFAULT_PARAMETERS,
  DEFAULT_SYSTEM_AGENTS,
  DEFAULT_MINDSTATE_CONFIG as DEMO_MINDSTATE_DEFINITION,
} from "@journey/schemas";

// NOTE: LLM models are now fetched dynamically via useModelsByProvider() hook
// See apps/web/src/hooks/queries/use-models.ts

/**
 * Slash commands for testing in preview (UI-specific)
 */
export const SLASH_COMMANDS = [
  {
    cmd: "/anxiety",
    label: "Anxious",
    text: "I'm really worried about this deadline. What if something goes wrong? I can't stop thinking about all the things that could fail...",
  },
  {
    cmd: "/happy",
    label: "Happy",
    text: "This is great! I'm so excited about this project. Everything is going wonderfully and I feel really good about our progress!",
  },
  {
    cmd: "/frustrated",
    label: "Frustrated",
    text: "This is so frustrating! Nothing is working the way it should. I've tried everything and I'm at my wit's end!",
  },
  {
    cmd: "/curious",
    label: "Curious",
    text: "This is fascinating! Tell me more about how this works. I'd love to understand the technical details and underlying mechanisms.",
  },
  { cmd: "/tired", label: "Tired", text: "I'm exhausted and can barely focus. Can we keep this simple? I don't have much mental energy right now..." },
  {
    cmd: "/urgent",
    label: "Urgent",
    text: "I need this fixed RIGHT NOW! This is critical and time-sensitive! The client is waiting and we're running out of time!",
  },
  {
    cmd: "/confused",
    label: "Confused",
    text: "I'm completely lost here. This is too complicated. Can you explain it in simpler terms? I don't understand any of this.",
  },
  {
    cmd: "/skeptical",
    label: "Skeptical",
    text: "I'm not sure I trust this approach. What evidence do you have that this actually works? Seems too good to be true...",
  },
  {
    cmd: "/reset",
    label: "Reset/Neutral",
    text: "I'm feeling much better now. Things have calmed down and I'm in a good headspace. Let's continue with a fresh perspective.",
  },
] as const;

/**
 * Generate a unique ID for new entities
 */
export function generateId(prefix: string = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}
