/**
 * Questionnaire State Manager
 *
 * Encapsulates questionnaire node state management for the journey engine.
 * Provides typed methods for state access and mutations during questionnaire execution.
 *
 * Benefits:
 * - Centralized state management for questionnaire nodes
 * - Type-safe state access and mutations
 * - Clear separation from handler logic
 * - Encapsulates question ordering, skip logic, and response tracking
 *
 * @module engine/state/questionnaire-state-manager
 */

import type {
  Question,
  QuestionnaireNodeData,
  QuestionnaireState,
  QuestionResponse,
} from "@journey/schemas";

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Questionnaire State Manager
 *
 * Wraps questionnaire state and provides typed methods for state operations.
 * Used during questionnaire node execution to track progress through questions.
 *
 * @example
 * ```ts
 * const manager = createQuestionnaireStateManager(initialState, setState);
 *
 * // Get current question
 * const questionId = manager.getCurrentQuestionId();
 *
 * // Record a response
 * manager.recordResponse({
 *   questionId: "q1",
 *   value: "option-a",
 *   buttonId: "btn-a",
 *   timestamp: new Date().toISOString()
 * });
 *
 * // Advance to next question
 * manager.advance();
 * ```
 */
export class QuestionnaireStateManager {
  private readonly state: QuestionnaireState;
  private readonly persistState: (state: QuestionnaireState) => void;

  constructor(state: QuestionnaireState, persistState: (state: QuestionnaireState) => void) {
    this.state = state;
    this.persistState = persistState;
  }

  // ===========================================================================
  // READ ACCESSORS
  // ===========================================================================

  /**
   * Get the current state (readonly snapshot)
   */
  getState(): QuestionnaireState {
    return this.state;
  }

  /**
   * Get the current question index (0-based)
   */
  getCurrentIndex(): number {
    return this.state.currentIndex;
  }

  /**
   * Get the total number of questions (including potentially skipped)
   */
  getTotalQuestions(): number {
    return this.state.questionOrder.length;
  }

  /**
   * Get the number of skipped questions
   */
  getSkippedCount(): number {
    return this.state.skipped.length;
  }

  /**
   * Get the effective total (excluding skipped)
   */
  getEffectiveTotalQuestions(): number {
    return this.state.questionOrder.length - this.state.skipped.length;
  }

  /**
   * Get the current question ID
   */
  getCurrentQuestionId(): string | undefined {
    return this.state.questionOrder[this.state.currentIndex];
  }

  /**
   * Check if questionnaire is complete (all questions answered or skipped)
   */
  isComplete(): boolean {
    return this.state.currentIndex >= this.state.questionOrder.length;
  }

  /**
   * Check if currently on first question
   */
  isFirstQuestion(): boolean {
    return this.state.currentIndex === 0;
  }

  /**
   * Get all recorded responses
   */
  getResponses(): QuestionResponse[] {
    return this.state.responses;
  }

  /**
   * Get the timer ID (if scheduled)
   */
  getTimerId(): string | undefined {
    return this.state.timerId;
  }

  /**
   * Check if a timer is scheduled
   */
  hasTimer(): boolean {
    return !!this.state.timerId;
  }

  /**
   * Get when the questionnaire was started
   */
  getStartedAt(): string {
    return this.state.startedAt;
  }

  // ===========================================================================
  // STATE MUTATIONS
  // ===========================================================================

  /**
   * Advance to the next question
   */
  advance(): void {
    this.state.currentIndex++;
    this.persist();
  }

  /**
   * Go back to the previous question
   * Also removes the last response
   *
   * @returns true if successfully went back, false if already at first question
   */
  goBack(): boolean {
    if (this.state.currentIndex === 0) {
      return false;
    }

    this.state.currentIndex--;
    // Remove last response when going back
    this.state.responses = this.state.responses.slice(0, -1);
    this.persist();
    return true;
  }

  /**
   * Mark a question as skipped and advance
   *
   * @param questionId - The ID of the question being skipped
   */
  skipQuestion(questionId: string): void {
    this.state.skipped.push(questionId);
    this.state.currentIndex++;
    this.persist();
  }

  /**
   * Record a response to the current question and advance
   *
   * @param response - The response to record
   */
  recordResponse(response: QuestionResponse): void {
    this.state.responses.push(response);
    this.state.currentIndex++;
    this.persist();
  }

  /**
   * Record a response without advancing (for cases where advance is handled separately)
   *
   * @param response - The response to record
   */
  addResponse(response: QuestionResponse): void {
    this.state.responses.push(response);
    this.persist();
  }

  /**
   * Set the timer ID when a timeout timer is scheduled
   *
   * @param timerId - The scheduled timer ID
   */
  setTimerId(timerId: string): void {
    this.state.timerId = timerId;
    this.persist();
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Persist state changes to the execution context
   */
  private persist(): void {
    this.persistState(this.state);
  }
}

/**
 * Create initial questionnaire state from node data.
 * Called when a session first enters a questionnaire node.
 *
 * @param nodeData - The questionnaire node configuration
 * @returns Initial QuestionnaireState
 */
export function createDefaultQuestionnaireState(nodeData: QuestionnaireNodeData): QuestionnaireState {
  let questionOrder = nodeData.questions.map((q) => q.id);

  if (nodeData.shuffle) {
    questionOrder = shuffleArray(questionOrder);
  }

  return {
    currentIndex: 0,
    questionOrder,
    responses: [],
    skipped: [],
    startedAt: new Date().toISOString(),
  };
}

/**
 * Factory function for creating QuestionnaireStateManager
 *
 * @param state - Current questionnaire state
 * @param setState - Function to persist state changes
 * @returns QuestionnaireStateManager instance with state operations
 *
 * @example
 * ```ts
 * const manager = createQuestionnaireStateManager(
 *   context.getState<QuestionnaireState>(),
 *   context.setState
 * );
 *
 * while (!manager.isComplete()) {
 *   const questionId = manager.getCurrentQuestionId();
 *   // ... show question, get response ...
 *   manager.recordResponse(response);
 * }
 * ```
 */
export function createQuestionnaireStateManager(
  state: QuestionnaireState,
  setState: (state: QuestionnaireState) => void
): QuestionnaireStateManager {
  return new QuestionnaireStateManager(state, setState);
}
