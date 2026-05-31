/**
 * Questionnaire Node Handler
 *
 * Handles questionnaire nodes - sequential Q&A with shared timeout.
 * Replaces multiple MESSAGE nodes for surveys/assessments.
 *
 * Key features:
 * - Multiple questions in a single node (1-20)
 * - Shared timeout for entire questionnaire
 * - Optional back navigation
 * - Conditional question skipping (skipIf)
 * - Consolidated response storage
 */

import type {
  Question,
  QuestionnaireNodeData,
  QuestionnaireState,
  QuestionResponse,
  TextValidation,
  EnrichedQuestionnaireResponse,
} from "@journey/schemas";
import type { ExecutionContext, HandlerResult, JourneyEvent, NodeEventResult } from "../../../types";
import { evaluateExpressionSync } from "../../../services/expression-service";
import { assertNodeData, getOrBuildEvaluationContext, isTimerEdge, sanitizeNodeLabel, storeNodeOutput, validateMedia } from "../../../utils";
import {
  createQuestionnaireStateManager,
  createDefaultQuestionnaireState,
  type QuestionnaireStateManager,
} from "../../../state";
import { BaseNodeHandler } from "../../base-handler";

/**
 * Simple expression evaluator for skipIf conditions
 * Uses the shared expression registry for consistent semantics
 */
function evaluateSkipCondition(expression: string, variables: Record<string, unknown>): boolean {
  try {
    return !!evaluateExpressionSync(expression, variables);
  } catch {
    // If evaluation fails, don't skip the question
    return false;
  }
}

/**
 * Validate text response against validation rules
 * Checks minLength, maxLength, and regex pattern
 */
function validateTextResponse(
  text: string,
  validation: TextValidation | undefined
): { valid: boolean; error?: string } {
  if (!validation) return { valid: true };

  const { pattern, minLength, maxLength, errorMessage } = validation;
  const defaultError = errorMessage || "Invalid response. Please try again.";

  // Check minLength
  if (minLength !== undefined && text.length < minLength) {
    return { valid: false, error: defaultError };
  }

  // Check maxLength
  if (maxLength !== undefined && text.length > maxLength) {
    return { valid: false, error: defaultError };
  }

  // Check regex pattern
  if (pattern) {
    try {
      const regex = new RegExp(pattern);
      if (!regex.test(text)) {
        return { valid: false, error: defaultError };
      }
    } catch {
      // Invalid regex, skip validation
    }
  }

  return { valid: true };
}

/**
 * Handler for questionnaire nodes
 *
 * State machine flow:
 * 1. Initialize state on first entry (determine question order, start timeout)
 * 2. Send introduction message if configured
 * 3. Send current question
 * 4. Wait for user response
 * 5. On response: store answer, advance to next question
 * 6. Repeat until all questions answered
 * 7. Send completion message, transition to next node
 */
export class QuestionnaireNodeHandler extends BaseNodeHandler<QuestionnaireNodeData> {
  readonly nodeType = "questionnaire" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { node, outgoingEdges, services, session, log } = context;
    const nodeData = assertNodeData<QuestionnaireNodeData>(node, "questionnaire");

    // Get or initialize questionnaire state
    let state = context.getState<QuestionnaireState>();
    let stateManager: QuestionnaireStateManager | undefined;

    if (!state) {
      // First entry - initialize state
      state = createDefaultQuestionnaireState(nodeData);
      context.setState(state);

      log.debug(
        {
          nodeId: node.id,
          questionCount: nodeData.questions.length,
          shuffled: nodeData.shuffle,
        },
        "questionnaire:initialized"
      );

      // Show introduction if configured
      if (nodeData.introduction) {
        const validMedia = validateMedia(nodeData.introduction.media);
        const evalContext = await getOrBuildEvaluationContext(context);
        await services.messenger.sendMessage(nodeData.introduction.content, undefined, validMedia, evalContext);
      }

      // Schedule timeout timer if configured
      if (nodeData.timeout) {
        // Find timeout edge or use targetNodeId
        const timeoutEdge = outgoingEdges.find(isTimerEdge);
        const timeoutTarget = nodeData.timeout.targetNodeId || timeoutEdge?.target;

        if (timeoutTarget) {
          const delayMs = nodeData.timeout.seconds * 1000;
          // Create a synthetic edge ID for the timer
          const timerEdgeId = timeoutEdge?.id || `questionnaire-timeout:${node.id}`;
          const timerId = await services.timer.scheduleTimer(delayMs, timerEdgeId);

          // Use state manager to set timer ID
          stateManager = createQuestionnaireStateManager(state, context.setState);
          stateManager.setTimerId(timerId);

          log.info(
            {
              nodeId: node.id,
              delayMs,
              targetNodeId: timeoutTarget,
            },
            "questionnaire:timeoutScheduled"
          );
        }
      }
    }

    // Build full evaluation context for skipIf expressions
    // This allows skipIf to use vars.*, nodes.*, session.*, user.* namespaces
    const evalContext = await getOrBuildEvaluationContext(context);

    // Find current question (skip any that should be skipped)
    const currentQuestion = findCurrentQuestion(state, nodeData, evalContext);

    if (!currentQuestion) {
      // All questions completed
      return handleCompletion(state, nodeData, context);
    }

    // Send current question
    await sendQuestion(currentQuestion, state, nodeData, context);

    log.debug(
      {
        nodeId: node.id,
        questionId: currentQuestion.id,
        index: state.currentIndex,
        total: state.questionOrder.length,
      },
      "questionnaire:questionSent"
    );

    // Wait for user response
    return { action: "wait" };
  }

  /**
   * Handle incoming events during questionnaire execution
   *
   * Processes button clicks and text messages to record responses
   * and advance through the questionnaire questions.
   *
   * @returns null if event not handled (timeout or already complete)
   * @returns NodeEventResult with instructions for re-execution or transition
   */
  async handleEvent(event: JourneyEvent, context: ExecutionContext): Promise<NodeEventResult | null> {
    const { session, node, log } = context;
    const nodeData = assertNodeData<QuestionnaireNodeData>(node, "questionnaire");

    // Only handle button_click and message events
    if (event.type !== "button_click" && event.type !== "message") {
      return null; // Fall through to normal routing (e.g., timeout)
    }

    // Get current state
    const state = context.getState<QuestionnaireState>();

    if (!state) {
      log.warn({ nodeId: node.id }, "questionnaire:handleEvent:noState");
      return null; // No state = haven't started, fall through
    }

    // Check if questionnaire is already complete
    if (state.currentIndex >= state.questionOrder.length) {
      return null; // Complete, fall through to normal routing
    }

    // Handle the response using the existing helper
    const result = handleQuestionnaireResponse(
      state,
      nodeData,
      {
        type: event.type === "button_click" ? "button_click" : "text_message",
        buttonId: event.payload.buttonId,
        text: event.payload.text,
      }
    );

    // Apply context update via stateManager (proper state management)
    if (result.contextUpdate) {
      context.stateManager.setContextValue(result.contextUpdate.key, result.contextUpdate.value);
    }

    log.debug(
      {
        nodeId: node.id,
        action: result.action,
        questionId: result.response?.questionId,
        currentIndex: state.currentIndex,
        validationError: result.validationError,
      },
      "questionnaire:handleEvent:responseHandled"
    );

    // Handle validation failure - send error and re-show question
    if (result.action === "validation_failed") {
      return {
        handled: true,
        action: "validation_failed",
        reExecute: true, // Re-show the same question
        timerAction: "none", // Don't cancel any timers for validation error
        validationError: result.validationError,
      };
    }

    // Response recorded - re-execute for next question
    return {
      handled: true,
      action: "continue",
      reExecute: true, // Re-execute to show next question or complete
      timerAction: "none", // Keep main timeout active
    };
  }
}

export const questionnaireHandler = new QuestionnaireNodeHandler();


/**
 * Find the current question to display
 * Skips questions based on skipIf conditions
 */
function findCurrentQuestion(
  state: QuestionnaireState,
  nodeData: QuestionnaireNodeData,
  variables: Record<string, unknown>
): Question | null {
  while (state.currentIndex < state.questionOrder.length) {
    const questionId = state.questionOrder[state.currentIndex];
    const question = nodeData.questions.find((q) => q.id === questionId);

    if (!question) {
      state.currentIndex++;
      continue;
    }

    // Check skip condition
    if (question.skipIf) {
      const shouldSkip = evaluateSkipCondition(question.skipIf, variables);

      if (shouldSkip) {
        state.skipped.push(questionId);
        state.currentIndex++;
        continue;
      }
    }

    return question;
  }

  return null; // All questions done
}

/**
 * Send the current question to the user
 */
async function sendQuestion(
  question: Question,
  state: QuestionnaireState,
  nodeData: QuestionnaireNodeData,
  context: ExecutionContext
): Promise<void> {
  const { services } = context;

  // Build message content
  let content = question.content;

  // Add progress indicator (e.g., "Question 1 of 7")
  const currentNum = state.currentIndex + 1;
  const totalQuestions = state.questionOrder.length - state.skipped.length;
  content = `Question ${currentNum} of ${totalQuestions}\n\n${content}`;

  // Add hint if present
  if (question.hint) {
    content = `${content}\n\n_${question.hint}_`;
  }

  // Build buttons only if responseType allows it (buttons or any, not text-only)
  let buttons =
    question.responseType !== "text"
      ? question.buttons?.map((btn) => ({
          id: btn.id,
          text: btn.text,
        }))
      : undefined;

  // Add back button if allowed and not on first question
  if (nodeData.allowBack && state.currentIndex > 0 && buttons) {
    buttons = [{ id: "__back__", text: "← Back" }, ...buttons];
  }

  // Validate media
  const validMedia = validateMedia(question.media);

  // Set activeButtons for button label logging
  // Questionnaire buttons are answer options handled internally by the handler,
  // so we use node.id as targetNodeId (handler processes via handleEvent)
  if (buttons && buttons.length > 0) {
    const activeButtons = buttons.map((btn) => ({
      id: btn.id,
      text: btn.text,
      targetNodeId: context.node.id, // Handler processes internally
      source: "questionnaire" as const,
    }));
    context.stateManager.setActiveButtons(activeButtons);
  } else {
    context.stateManager.clearActiveButtons();
  }

  // Send message (use cached context for template substitution)
  const evalContext = await getOrBuildEvaluationContext(context);
  await services.messenger.sendMessage(content, buttons, validMedia, evalContext);
}

/**
 * Handle questionnaire completion
 */
async function handleCompletion(
  state: QuestionnaireState,
  nodeData: QuestionnaireNodeData,
  context: ExecutionContext
): Promise<HandlerResult> {
  const { services, session, node, outgoingEdges, log } = context;

  // Cancel timeout timer
  if (state.timerId) {
    await services.timer.cancelTimer(state.timerId);
  }

  // Always store consolidated responses to context for persistence
  // Use storeAllAs key if configured, otherwise use sanitized node label
  // Include enriched data with question text and button labels for exports
  const responseMap: Record<string, EnrichedQuestionnaireResponse> = {};
  for (const response of state.responses) {
    // Find the question definition to get the question text
    const question = nodeData.questions?.find((q) => q.id === response.questionId);

    // For button responses, find the button label
    let answerLabel: string | undefined;
    if (response.buttonId && question?.buttons) {
      const button = question.buttons.find((b) => b.id === response.buttonId);
      answerLabel = button?.text;
    }

    responseMap[response.questionId] = {
      questionText: question?.content || "",
      answer: response.value,
      answerLabel,
      answeredAt: response.timestamp,
    };
  }

  const storageKey = nodeData.storeAllAs || sanitizeNodeLabel(nodeData.label || `questionnaire_${node.id}`);
  const hasStoreAllAs = Boolean(nodeData.storeAllAs);

  context.stateManager.setContextValue(storageKey, responseMap);

  // Store as node output for cross-node references and session recovery
  storeNodeOutput(session, node, responseMap, context.stateManager);
  if (hasStoreAllAs) {
    storeNodeOutput(session, node, responseMap, context.stateManager, storageKey);
  }

  // Show completion message if configured
  if (nodeData.completion) {
    const validMedia = validateMedia(nodeData.completion.media);
    const evalContext = await getOrBuildEvaluationContext(context);
    await services.messenger.sendMessage(nodeData.completion.content, undefined, validMedia, evalContext);

    // Wait before transition
    const delaySeconds = nodeData.completion.delayBeforeTransition ?? 2;
    if (delaySeconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
  }

  log.info(
    {
      nodeId: node.id,
      responses: state.responses.length,
      skipped: state.skipped.length,
    },
    "questionnaire:completed"
  );

  // Determine next node
  // Priority: 1) nodeData.next (direct target), 2) non-timer outgoing edge
  let targetNodeId = nodeData.next;

  if (!targetNodeId) {
  const completionEdge = outgoingEdges.find((edge) => !isTimerEdge(edge));
    targetNodeId = completionEdge?.target;
  }

  if (!targetNodeId) {
    log.warn({ nodeId: node.id }, "questionnaire:noTargetNode");
    return { action: "complete" };
  }

  return {
    action: "transition",
    targetNodeId,
    trigger: "questionnaire_complete",
  };
}

/**
 * Handle response to a questionnaire question
 * Called by event router when user responds
 *
 * @returns Updated state and whether to continue (re-execute) or transition
 */
export function handleQuestionnaireResponse(
  state: QuestionnaireState,
  nodeData: QuestionnaireNodeData,
  event: { type: "button_click" | "text_message"; buttonId?: string; text?: string }
): {
  action: "continue" | "back" | "validation_failed";
  response?: QuestionResponse;
  validationError?: string;
  /** Context key-value to store via stateManager (caller must apply) */
  contextUpdate?: { key: string; value: string };
} {
  const questionId = state.questionOrder[state.currentIndex];
  const question = nodeData.questions.find((q) => q.id === questionId);

  // Handle back button
  if (event.type === "button_click" && event.buttonId === "__back__") {
    if (state.currentIndex > 0) {
      state.currentIndex--;
      // Remove last response
      state.responses = state.responses.slice(0, -1);
    }
    return { action: "back" };
  }

  // Determine response value
  const value = event.type === "button_click" ? (event.buttonId ?? "") : (event.text ?? "");

  // Validate text responses if validation rules are configured
  if (event.type === "text_message" && question?.validation) {
    const validationResult = validateTextResponse(value, question.validation);
    if (!validationResult.valid) {
      return {
        action: "validation_failed",
        validationError: validationResult.error,
      };
    }
  }

  // Create response record
  const response: QuestionResponse = {
    questionId,
    value,
    buttonId: event.type === "button_click" ? event.buttonId : undefined,
    timestamp: new Date().toISOString(),
  };

  // Store response
  state.responses.push(response);

  // Advance to next question
  state.currentIndex++;

  // Return context update for caller to apply via stateManager
  // (previously mutated session.context directly - now properly deferred)
  const contextUpdate = question?.storeResponseAs
    ? { key: question.storeResponseAs, value }
    : undefined;

  return { action: "continue", response, contextUpdate };
}
