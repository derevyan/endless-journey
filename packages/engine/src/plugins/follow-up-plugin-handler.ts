/**
 * Follow-Up Plugin Handler
 *
 * Handles follow-up sequence plugins embedded in node.data.plugins.
 *
 * Execution flow:
 * 1. Parent node executes → onParentExecute schedules first follow-up timer
 * 2. Timer fires → onTimeout sends follow-up message, schedules next or transitions
 * 3. User responds → onUserResponse cancels pending timers
 *
 * AI Mode (when ai.enabled = true):
 * - step.content becomes AI instructions
 * - LLM generates personalized message using context
 * - Fallback: step.fallbackContent ?? step.content
 *
 * With embedded plugins, the handler receives FollowUpPluginData directly
 * (not wrapped in PluginNode). Plugin identification uses parentNodeId + pluginIndex.
 */

import {
  AiGenerationError,
  durationToMs,
  EventTypes,
  PluginTypes,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  type EnhancedUserJourney,
  type FollowUpAiConfig,
  type FollowUpButton,
  type FollowUpPluginData,
  type FollowUpSequence,
  type FollowUpStep,
  type Media,
} from "@journey/schemas";
import { serializeError } from "@journey/logger";
import type { FollowUpAIGenerationConfig } from "../types";
import {
  createAIContextBuilder,
  buildUserProfileContext,
  buildNodeOutputContext,
  buildSessionContext,
} from "../services/ai-context-builder";
import type {
  PluginDebugStateProvider,
  PluginExecuteResult,
  PluginExecutionContext,
  PluginHandler,
  PluginTimeoutResult,
} from "./types";
import { generatePluginId } from "./types";

/**
 * Default instructions used when step.content is empty and no plugin-level defaultInstructions set.
 * Provides sensible baseline behavior for AI-generated follow-ups.
 */
const DEFAULT_FOLLOWUP_AI_INSTRUCTIONS =
  "Analyze the available context and generate a friendly, personalized notification message. " +
  "Match the user's language if detectable. Keep it warm, concise, and helpful.";

// =============================================================================
// BUTTON TRANSFORMATION HELPERS (DRY)
// =============================================================================

/**
 * Transform follow-up buttons to messenger format (id + text only).
 * Used when sending messages via the messenger service.
 */
function transformButtonsForMessenger(buttons?: FollowUpButton[]) {
  return buttons?.map((btn) => ({
    id: btn.id,
    text: btn.text,
  }));
}

/**
 * Transform follow-up buttons to session format (with targetNodeId and source).
 * Used when setting active buttons in session state for routing.
 *
 * Type guard in filter ensures TypeScript knows targetNodeId is string (not string | undefined).
 */
function transformButtonsForSession(
  buttons: FollowUpButton[]
): Array<{ id: string; text: string; targetNodeId: string; source: "plugin" }> {
  return buttons
    .filter((btn): btn is FollowUpButton & { targetNodeId: string } =>
      Boolean(btn.targetNodeId)
    )
    .map((btn) => ({
      id: btn.id,
      text: btn.text,
      targetNodeId: btn.targetNodeId, // No assertion needed - type guard ensures this
      source: "plugin" as const,
    }));
}

/**
 * Follow-Up Plugin Handler
 *
 * Manages follow-up message sequences for embedded plugins.
 */
export class FollowUpPluginHandler implements PluginHandler<FollowUpPluginData> {
  readonly pluginType = PluginTypes.FOLLOWUP;

  /**
   * Schedule the first follow-up timer when parent node executes.
   */
  async onParentExecute(
    pluginData: FollowUpPluginData,
    parentNodeId: string,
    pluginIndex: number,
    context: PluginExecutionContext
  ): Promise<PluginExecuteResult> {
    const { services, log } = context;

    // Generate synthetic pluginId for timer identification
    const pluginId = generatePluginId(parentNodeId, pluginIndex);

    // Check if plugin is enabled and has steps
    if (!pluginData.enabled || !pluginData.steps || pluginData.steps.length === 0) {
      log.debug({ pluginId, parentNodeId, pluginIndex }, "followUpPlugin:disabled");
      return { action: "noop" };
    }

    // Schedule first follow-up timer
    const firstStep = pluginData.steps[0];
    const delayMs = durationToMs(firstStep.delay);

    // Schedule via plugin follow-up timer method
    // This adds to both pluginFollowUpMap (for hasPluginFollowUp lookup) AND session.pendingPluginFollowUps
    const timerId = await services.timer.schedulePluginFollowUpTimer(
      pluginId,
      parentNodeId,
      0, // stepIndex
      delayMs,
      {
        enabled: pluginData.enabled,
        steps: pluginData.steps,
        exitPath: pluginData.exitPath,
        cancelOnAnyResponse: pluginData.cancelOnAnyResponse,
        ai: pluginData.ai,
      }
    );

    log.info(
      {
        pluginId,
        parentNodeId,
        pluginIndex,
        stepIndex: 0,
        delayMs,
        timerId,
        totalSteps: pluginData.steps.length,
      },
      "followUpPlugin:scheduled"
    );

    return { action: "scheduled", timerId };
  }

  /**
   * Handle follow-up timer timeout.
   *
   * Two timer types:
   * - "send": Delay BEFORE sending the follow-up message
   * - "response": Wait AFTER sending for user response before exiting
   *
   * This method dispatches to the appropriate handler based on timer type.
   */
  async onTimeout(
    timerId: string,
    context: PluginExecutionContext
  ): Promise<PluginTimeoutResult> {
    const { log, pluginService } = context;

    // 1. Get & validate context
    const pluginContext = pluginService.getPluginFollowUpContext(timerId);
    if (!pluginContext) {
      log.error({ timerId }, "followUpPlugin:timeout:noContext");
      return { action: "continue" };
    }

    const { pluginId, parentNodeId, stepIndex, sequence, timerType } = pluginContext;

    // 2. Handle based on timer type
    if (timerType === "send") {
      return this.handleSendTimeout(timerId, pluginId, parentNodeId, stepIndex, sequence, context);
    }

    if (timerType === "response") {
      return this.handleResponseTimeout(timerId, pluginId, stepIndex, sequence, context);
    }

    log.error({ timerId, timerType }, "followUpPlugin:timeout:unknownTimerType");
    return { action: "continue" };
  }

  /**
   * Handle SEND timer firing - sends the follow-up message.
   * This is the original send logic, extracted into its own method.
   */
  private async handleSendTimeout(
    timerId: string,
    pluginId: string,
    parentNodeId: string,
    stepIndex: number,
    sequence: FollowUpSequence,
    context: PluginExecutionContext
  ): Promise<PluginTimeoutResult> {
    const { services, log } = context;
    const step = sequence.steps[stepIndex];

    if (!step) {
      log.error({ timerId, pluginId, stepIndex }, "followUpPlugin:timeout:invalidStep");
      this.removePluginFollowUp(context, timerId);
      return { action: "continue" };
    }

    // Remove from pending (mark as fired)
    this.removePluginFollowUp(context, timerId);

    // Determine message content (AI-generated or static)
    let messageContent = step.content;

    if (sequence.ai?.enabled) {
      try {
        // Use step instructions → plugin default → system default (fallback chain)
        const instructions = step.content?.trim()
          || sequence.ai.defaultInstructions?.trim()
          || DEFAULT_FOLLOWUP_AI_INSTRUCTIONS;

        messageContent = await this.generateAiContent(instructions, sequence.ai, context, parentNodeId);
        log.info({ pluginId, stepIndex }, "followUpPlugin:aiGenerated");
      } catch (error) {
        const aiError = new AiGenerationError(
          sequence.ai.model ?? "default",
          error instanceof Error ? error : undefined
        );
        log.warn(
          { err: serializeError(aiError), pluginId, stepIndex },
          "followUpPlugin:aiFailed:usingFallback"
        );
        messageContent = step.fallbackContent ?? step.content;
      }
    }

    // Send follow-up message via messenger service
    try {
      await this.sendFollowUpMessage(services, messageContent, step.buttons, step.media);
    } catch (error) {
      log.error(
        { err: serializeError(error), timerId, pluginId, stepIndex },
        "followUpPlugin:sendFailed"
      );
    }

    // Log TIMER_FOLLOWUP event
    this.logFollowUpEvent(services, parentNodeId, pluginId, stepIndex, sequence, timerId, log);

    // Update session buttons
    this.setActiveButtonsInSession(context, step, pluginId, stepIndex);

    // Determine next action (schedule next step, schedule response timeout, or continue)
    return this.handlePostSendLogic(pluginId, parentNodeId, stepIndex, step, sequence, services, log);
  }

  /**
   * Handle RESPONSE timer firing - user didn't respond in time.
   * Now we actually transition to the exit path.
   */
  private async handleResponseTimeout(
    timerId: string,
    pluginId: string,
    stepIndex: number,
    sequence: FollowUpSequence,
    context: PluginExecutionContext
  ): Promise<PluginTimeoutResult> {
    const { log } = context;

    // Remove from pending
    this.removePluginFollowUp(context, timerId);

    log.info(
      { pluginId, stepIndex, exitNodeId: sequence.exitPath?.nodeId },
      "followUpPlugin:responseTimeout:exiting"
    );

    // Transition to exit path
    if (sequence.exitPath?.nodeId) {
      return {
        action: "transition",
        targetNodeId: sequence.exitPath.nodeId,
        trigger: "followup_plugin_exit",
      };
    }

    // Shouldn't happen (response timer only scheduled when exitPath exists)
    return { action: "continue" };
  }

  /**
   * After sending a follow-up, determine what to do next:
   * - Schedule next step (if not last and not exitOnTimeout)
   * - Schedule response timeout (if exiting with exitPath configured)
   * - Continue waiting (if exiting without exitPath)
   */
  private async handlePostSendLogic(
    pluginId: string,
    parentNodeId: string,
    stepIndex: number,
    step: FollowUpStep,
    sequence: FollowUpSequence,
    services: PluginExecutionContext["services"],
    log: ReturnType<typeof import("@journey/logger").createLogger>
  ): Promise<PluginTimeoutResult> {
    const isLastStep = stepIndex === sequence.steps.length - 1;
    const shouldExit = step.exitOnTimeout || isLastStep;

    // Not exiting - schedule next step
    if (!shouldExit) {
      await this.scheduleNextFollowUpStep(services, pluginId, parentNodeId, stepIndex, sequence, log);
      return { action: "continue" };
    }

    // Exiting - check if we have an exit path
    if (sequence.exitPath?.nodeId) {
      // Schedule RESPONSE timeout (wait for user to respond before transitioning)
      const timeoutMs = this.getExitPathTimeout(sequence);

      await services.timer.schedulePluginFollowUpTimer(
        pluginId,
        parentNodeId,
        stepIndex,
        timeoutMs,
        sequence,
        "response" // Response timer type - waits for user response
      );

      log.info(
        { pluginId, stepIndex, timeoutMs, exitNodeId: sequence.exitPath.nodeId },
        "followUpPlugin:responseTimeoutScheduled"
      );

      return { action: "continue" }; // Wait for response or response timeout
    }

    // No exit path - stay on current node indefinitely
    log.info({ pluginId, stepIndex }, "followUpPlugin:sequenceComplete:noExitPath");
    return { action: "continue" };
  }

  /**
   * Get the exit path timeout in milliseconds.
   * Default: 59 seconds if not specified.
   */
  private getExitPathTimeout(sequence: FollowUpSequence): number {
    if (sequence.exitPath?.timeout) {
      return durationToMs(sequence.exitPath.timeout);
    }
    return 59 * 1000; // 59 seconds default
  }

  /**
   * Send a follow-up message via messenger service.
   * Uses the proper messenger service which provides:
   * - Template substitution ({{variable}} syntax)
   * - Retry logic (3 attempts with backoff)
   * - onMessageSent callback
   * - EVENT_MESSAGE logging
   */
  private async sendFollowUpMessage(
    services: PluginExecutionContext["services"],
    content: string,
    buttons?: FollowUpButton[],
    media?: Media
  ): Promise<void> {
    // Use DRY helper for button transformation
    const buttonConfigs = transformButtonsForMessenger(buttons);

    // Convert media to messenger format (include mediaId for Telegram file caching)
    const mediaConfig = media
      ? { type: media.type as "image" | "video", url: media.url, mediaId: media.mediaId }
      : undefined;

    // Use messenger service - handles template substitution, retries, event logging
    await services.messenger.sendMessage(content, buttonConfigs, mediaConfig);
  }

  // ==========================================================================
  // AI GENERATION METHODS
  // ==========================================================================

  /**
   * Generate AI-enhanced follow-up message content.
   * Uses the step.content as instructions for the LLM.
   *
   * Uses centralized model configuration:
   * - PRIMARY_MODEL (gemini-3-flash) as default
   * - FALLBACK_MODEL (claude-haiku) for resilience
   * - Default temperature 0.7 for chat-like responses
   *
   * Requires FollowUpAIService to be injected via services.followUpAI.
   * If the service is not available, throws an error (caller handles fallback).
   */
  private async generateAiContent(
    stepInstructions: string,
    aiConfig: FollowUpAiConfig,
    context: PluginExecutionContext,
    parentNodeId: string
  ): Promise<string> {
    const { session, log, services } = context;

    // Check if AI service is available
    const aiService = services.followUpAI;
    if (!aiService) {
      throw new Error("FollowUpAIService not available - AI generation disabled");
    }

    // Build system prompt with auto-appended context
    const systemPrompt = this.buildFollowUpSystemPrompt(
      stepInstructions,
      undefined, // Uses default persona - custom instructions go in customContext
      session,
      parentNodeId,
      aiConfig.includeUserProfile ?? true,
      aiConfig.includeNodeContext ?? true,
      aiConfig.includeSessionContext ?? false,
      aiConfig.customContext
    );

    // Resolve model - use user's choice or default to PRIMARY_MODEL
    const model = aiConfig.model ?? PRIMARY_MODEL.id;

    // Build generation config
    const generationConfig: FollowUpAIGenerationConfig = {
      model,
      temperature: 0.7, // Default chat temperature
      reasoningEffort: "high",
      maxTokens: 500, // Concise notifications
      fallbackModels: [FALLBACK_MODEL.id],
      organizationId: context.organizationId,
    };

    log.debug(
      { model, hasCustomContext: !!aiConfig.customContext },
      "followUpPlugin:aiGeneration:start"
    );

    // Call injected AI service
    const response = await aiService.generateContent(
      systemPrompt,
      stepInstructions,
      generationConfig
    );

    log.info(
      {
        model: response.modelUsed ?? model,
        tokens: response.tokenUsage?.totalTokens,
        costUSD: response.tokenUsage?.costUSD,
      },
      "followUpPlugin:aiGeneration:complete"
    );

    return response.content;
  }

  /**
   * Build system prompt for follow-up generation using AIContextBuilder.
   *
   * Architecture:
   * - System prompt = persona/voice + context data + output rules
   * - User message = task instructions (step.content) - passed separately to generateChatResponse
   *
   * System Prompt Structure:
   * 1. USER'S SYSTEM PROMPT (full control - their persona/brand voice)
   * 2. CONTEXT SECTIONS (conditionally included based on settings)
   *    - User Profile (if includeUserProfile) - name, username
   *    - Node Context (if includeNodeContext) - parent node output (smart extraction by type)
   *    - Session Context (if includeSessionContext) - tags, variables, conversation history
   *    - Custom Context (if provided) - user-defined template with resolved variables
   * 3. OUTPUT GUIDELINES (minimal, essential rules)
   */
  private buildFollowUpSystemPrompt(
    _stepInstructions: string,
    customSystemPrompt: string | undefined,
    session: EnhancedUserJourney,
    parentNodeId: string,
    includeUserProfile: boolean,
    includeNodeContext: boolean,
    includeSessionContext: boolean,
    customContext?: string
  ): string {
    const context = session.context ?? {};
    const builder = createAIContextBuilder({ includeHeaders: false });

    // 1. USER'S SYSTEM PROMPT (FULL CONTROL) - persona/voice only
    builder.section("").text(customSystemPrompt ?? "You are a friendly notification assistant.");

    // 2. CONTEXT DATA (conditionally included)

    // User Profile - uses specialized builder
    if (includeUserProfile) {
      const profileContext = buildUserProfileContext(context);
      if (profileContext) {
        builder.text("\n---\n" + profileContext);
      }
    }

    // Node Context - uses smart extraction by node type
    if (includeNodeContext) {
      const nodeOutputs = session.nodeOutputs ?? {};

      // Find the parent node's output (the node this follow-up is attached to)
      let targetOutput = Object.values(nodeOutputs).find(
        (output) => output.nodeId === parentNodeId
      );

      // Fallback: if parent node output not found, use most recent output
      if (!targetOutput) {
        targetOutput = Object.values(nodeOutputs)
          .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
          .at(0);
      }

      if (targetOutput) {
        const nodeContext = buildNodeOutputContext(
          targetOutput.nodeLabel ?? "Unknown",
          targetOutput.nodeType ?? "unknown",
          targetOutput.data
        );
        if (nodeContext) {
          builder.text("\n---\n" + nodeContext);
        }
      }
    }

    // Session Context - uses specialized builder
    if (includeSessionContext) {
      const sessionContext = buildSessionContext({
        tags: session.tags,
        context: session.context,
        history: session.history,
      });
      if (sessionContext) {
        builder.text("\n---\n" + sessionContext);
      }
    }

    // Custom Context - user-defined template (variables already resolved by template service)
    if (customContext?.trim()) {
      builder
        .section("Custom Context")
        .text(customContext);
    }

    // 3. OUTPUT GUIDELINES (minimal essential rules)
    builder.section("Output Rules").list([
      "Output ONLY the final message text",
      "Keep it concise (1-3 sentences max)",
      "Do not include explanations or meta-commentary",
    ]);

    return builder.build();
  }

  /**
   * Log TIMER_FOLLOWUP event for debugging and SSE message flow.
   * Note: ENGINE_MESSAGE is now logged by the messenger service.
   */
  private logFollowUpEvent(
    services: PluginExecutionContext["services"],
    parentNodeId: string,
    pluginId: string,
    stepIndex: number,
    sequence: FollowUpSequence,
    timerId: string,
    log: ReturnType<typeof import("@journey/logger").createLogger>
  ): void {
    // Log the follow-up timer event
    services.eventLogger.logEvent({
      type: EventTypes.TIMER_FOLLOWUP,
      nodeId: parentNodeId,
      payload: {
        timerId,
        pluginId,
        stepIndex,
        totalSteps: sequence.steps.length,
        hasExitOnTimeout: sequence.steps[stepIndex]?.exitOnTimeout,
      },
    });

    // Note: ENGINE_MESSAGE is now logged by services.messenger.sendMessage()

    log.info(
      { pluginId, parentNodeId, stepIndex, totalSteps: sequence.steps.length },
      "followUpPlugin:sent"
    );
  }

  /**
   * Set active buttons in session for unified button routing.
   */
  private setActiveButtonsInSession(
    context: PluginExecutionContext,
    step: FollowUpStep,
    pluginId: string,
    stepIndex: number
  ): void {
    const { stateManager, log } = context;

    if (step.buttons && step.buttons.length > 0) {
      // Use DRY helper with proper type guard (no more non-null assertion)
      const buttons = transformButtonsForSession(step.buttons);
      stateManager.setActiveButtons(buttons);
      log.debug({ pluginId, stepIndex, buttonCount: buttons.length }, "followUpPlugin:activeButtonsSet");
    } else {
      stateManager.clearActiveButtons();
    }
  }

  /**
   * Schedule the next follow-up step in the sequence.
   */
  private async scheduleNextFollowUpStep(
    services: PluginExecutionContext["services"],
    pluginId: string,
    parentNodeId: string,
    stepIndex: number,
    sequence: FollowUpSequence,
    log: ReturnType<typeof import("@journey/logger").createLogger>
  ): Promise<void> {
    const nextStepIndex = stepIndex + 1;
    const nextStep = sequence.steps[nextStepIndex];
    const delayMs = durationToMs(nextStep.delay);

    await services.timer.schedulePluginFollowUpTimer(
      pluginId,
      parentNodeId,
      nextStepIndex,
      delayMs,
      sequence
    );

    log.debug(
      { pluginId, nextStepIndex, delayMs, totalSteps: sequence.steps.length },
      "followUpPlugin:nextScheduled"
    );
  }

  /**
   * Remove a follow-up from session pending list.
   */
  private removePluginFollowUp(context: PluginExecutionContext, timerId: string): void {
    context.stateManager.removePendingPluginFollowUp(timerId);
  }
}

/**
 * Create a follow-up plugin handler instance.
 */
export function createFollowUpPluginHandler(): FollowUpPluginHandler {
  return new FollowUpPluginHandler();
}

// =============================================================================
// STATE PROVIDER FOR SIMULATOR UI
// =============================================================================

/**
 * Extract debug state from session's pending plugin follow-ups.
 * Separate function enables type derivation without circular reference.
 */
function extractFollowUpDebugState(
  sessionState: EnhancedUserJourney["pendingPluginFollowUps"]
) {
  if (!sessionState || sessionState.length === 0) {
    return undefined;
  }

  return sessionState.map((fu) => ({
    timerId: fu.timerId,
    pluginId: fu.pluginId,
    parentNodeId: fu.parentNodeId,
    stepIndex: fu.stepIndex,
    totalSteps: fu.sequence.steps.length,
    triggersAt: fu.triggersAt,
    timerType: fu.timerType, // "send" = delay before sending, "response" = wait after sending
  }));
}

/**
 * Debug state type for follow-up plugin in simulator UI.
 * Derived from the extractFollowUpDebugState return type (single source of truth).
 */
export type FollowUpDebugState = NonNullable<
  ReturnType<typeof extractFollowUpDebugState>
>[number];

/**
 * Debug state provider for follow-up plugin.
 *
 * Extracts pending follow-up timers from session state and transforms
 * them into a format suitable for the simulator debug panel.
 */
export const followUpDebugStateProvider: PluginDebugStateProvider<
  EnhancedUserJourney["pendingPluginFollowUps"],
  FollowUpDebugState[] | undefined
> = {
  pluginType: PluginTypes.FOLLOWUP,
  sessionStateKey: "pendingPluginFollowUps",
  extractDebugState: extractFollowUpDebugState,
};
