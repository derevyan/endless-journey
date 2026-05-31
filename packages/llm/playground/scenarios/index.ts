/**
 * Conversation Scenarios for LLM Playground
 *
 * Provides test scenarios for question understanding and other LLM modules.
 * Scenarios simulate real-world conversation patterns with unanswered questions.
 *
 * All scenarios are loaded from scenarios.json config file.
 */

import scenariosData from "./scenarios.json";

// ============================================================================
// Types
// ============================================================================

/**
 * A single message in conversation history
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * A conversation scenario for testing question understanding
 */
export interface ConversationScenario {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what this scenario tests */
  description: string;
  /** Conversation history before the final user question */
  history: ConversationMessage[];
  /** The final user input that needs question synthesis */
  userInput: string;
  /** Expected synthesis (for reference, not strict matching) */
  expectedSynthesis?: string;
  /** Tags for categorization */
  tags?: string[];
}

// ============================================================================
// Scenario Registry
// ============================================================================

/**
 * All available scenarios for question understanding testing
 * Loaded from scenarios.json config file
 */
export const questionUnderstandingScenarios: ConversationScenario[] =
  scenariosData.scenarios;

/**
 * Get a scenario by ID
 */
export function getScenarioById(id: string): ConversationScenario | undefined {
  return questionUnderstandingScenarios.find((s) => s.id === id);
}

/**
 * Format conversation history as a single string for LLM processing
 */
export function formatHistoryAsString(history: ConversationMessage[]): string {
  return history
    .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
    .join("\n");
}
