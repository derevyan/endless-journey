/**
 * Service Factory
 *
 * Responsible for initializing and wiring together all services used by the SessionEngine.
 */

import { createLogger, serializeError } from "@journey/logger";
import { randomUUID } from "crypto";
import { EventTypes, type ButtonConfig, type EnhancedUserJourney, type InteractionEvent } from "@journey/schemas";
import type { JourneyMindstateConfig } from "@journey/schemas";
import { createConditionEvaluator, createExpressionService, createTemplateService, createTimerService, createVariableService, createWebhookExecutor } from ".";
import { createConversationHistoryService } from "./conversation-history-service";
import { buildMindstateNamespace, type MindstateNamespace } from "../utils/context";
import type { SessionStateManager } from "../state/session-state-manager";
import type {
  AgentWorkflowService,
  CrmService,
  EngineServices,
  EventLogger,
  GetTagsCallback,
  GetUserVariablesCallback,
  GetVariablesCallback,
  JourneyMessage,
  MessagingAdapter,
  MessengerService,
  MindstateService,
  SendMessageOptions,
  SendMessageResult,
  SessionEngineConfig,
  TagOperationCallback,
  TagService,
  TemplateService,
  UserVariableOperationCallback,
  VariableOperationCallback,
  VariableService,
  WorkflowEventEmitterFn,
} from "../types";
import { buildFullContext, withRetry } from "../utils";

export class ServiceFactory {
  private session: EnhancedUserJourney;
  private stateManager: SessionStateManager;
  private adapter: MessagingAdapter;
  private config: SessionEngineConfig;
  private log: ReturnType<typeof createLogger>;

  // Config shortcuts
  private onEventCallback: ((event: InteractionEvent) => void) | null;
  private historyRetention: SessionEngineConfig["historyRetention"] | null;
  private onTagOperationCallback: TagOperationCallback | null;
  private onGetTagsCallback: GetTagsCallback | null;
  private onVariableOperationCallback: VariableOperationCallback | null;
  private onGetVariablesCallback: GetVariablesCallback | null;
  private onUserVariableOperationCallback: UserVariableOperationCallback | null;
  private onGetUserVariablesCallback: GetUserVariablesCallback | null;
  private onMessageSentCallback: SessionEngineConfig["onMessageSent"] | null;
  private organizationId: string | null;
  private clientData: SessionEngineConfig["clientData"] | null;
  private crmService: CrmService | null;
  private defaultPipelineId: string | null;
  private strictVariableOperations: boolean;
  private mindstateService: MindstateService | null;
  private memoryService: SessionEngineConfig["memoryService"] | null;
  private agentWorkflowService: AgentWorkflowService | null;
  private workflowEventEmitter: WorkflowEventEmitterFn | null;
  private mindstateConfig: JourneyMindstateConfig | null;
  private followUpAIService: SessionEngineConfig["followUpAIService"] | null;

  constructor(
    session: EnhancedUserJourney,
    stateManager: SessionStateManager,
    adapter: MessagingAdapter,
    config: SessionEngineConfig,
    log: ReturnType<typeof createLogger>
  ) {
    this.session = session;
    this.stateManager = stateManager;
    this.adapter = adapter;
    this.config = config;
    this.log = log;

    this.onEventCallback = config.onEvent || null;
    this.historyRetention = config.historyRetention || null;
    this.onTagOperationCallback = config.onTagOperation || null;
    this.onGetTagsCallback = config.onGetTags || null;
    this.onVariableOperationCallback = config.onVariableOperation || null;
    this.onGetVariablesCallback = config.onGetVariables || null;
    this.onUserVariableOperationCallback = config.onUserVariableOperation || null;
    this.onGetUserVariablesCallback = config.onGetUserVariables || null;
    this.onMessageSentCallback = config.onMessageSent || null;
    this.organizationId = config.organizationId || null;
    this.clientData = config.clientData || null;
    this.crmService = config.crmService || null;
    this.defaultPipelineId = config.defaultPipelineId || null;
    this.strictVariableOperations = config.strictVariableOperations ?? false;
    this.mindstateService = config.mindstateService || null;
    this.memoryService = config.memoryService || null;
    this.agentWorkflowService = config.agentWorkflowService || null;
    this.workflowEventEmitter = config.workflowEventEmitter || null;
    this.mindstateConfig = config.mindstateConfig || null;
    this.followUpAIService = config.followUpAIService || null;
  }

  createServices(getOutgoingEdges: (nodeId: string) => any[]): EngineServices {
    const template = createTemplateService();
    const eventLogger = this.createEventLogger();
    const variable = createVariableService(
      {
        journeyId: this.session.journeyId,
        organizationId: this.organizationId || "",
        userId: this.session.userId,
        log: this.log,
      },
      {
        onExecute: this.onVariableOperationCallback ?? undefined,
        onUserExecute: this.onUserVariableOperationCallback ?? undefined,
        onGetVariables: this.onGetVariablesCallback ?? undefined,
        onGetUserVariables: this.onGetUserVariablesCallback ?? undefined,
        strict: this.strictVariableOperations,
        onStrictError: () => {
          this.stateManager.setStatus("error");
        },
      }
    );
    const messenger = this.createMessengerService(template, variable, eventLogger);

    const timer = createTimerService({
      sessionId: this.session.sessionId,
      session: this.session,
      stateManager: this.stateManager,
      adapter: this.adapter,
      getOutgoingEdges,
      log: this.log,
      timerScale: this.config.timerScale,
    });

    const conditionEvaluator = createConditionEvaluator({
      onDebug: (msg, data) => this.log.debug(data, `engine:${msg}`),
      onWarn: (msg, data) => this.log.warn(data, `engine:${msg}`),
    });

    const webhookExecutor = createWebhookExecutor({
      template,
      onDebug: (msg, data) => this.log.debug({ ...data, nodeId: this.session.currentNodeId }, `engine:${msg}`),
      onInfo: (msg, data) => this.log.info({ ...data, nodeId: this.session.currentNodeId }, `engine:${msg}`),
      onWarn: (msg, data) => this.log.warn({ ...data, nodeId: this.session.currentNodeId }, `engine:${msg}`),
    });

    const tag = this.createTagService();
    const crm = this.crmService ? this.createCrmServiceWrapper(this.crmService) : undefined;
    const mindstate = this.mindstateService ? this.createMindstateServiceWrapper(this.mindstateService) : undefined;
    const memory = this.memoryService ?? undefined;
    const agentWorkflow = this.agentWorkflowService ?? undefined;
    const workflowEventEmitter = this.workflowEventEmitter ?? undefined;
    const expression = createExpressionService();
    const conversationHistory = createConversationHistoryService();

    return {
      messenger,
      timer,
      eventLogger,
      conditionEvaluator,
      webhookExecutor,
      template,
      tag,
      variable,
      crm,
      mindstate,
      memory,
      agentWorkflow,
      workflowEventEmitter,
      expression,
      conversationHistory,
      followUpAI: this.followUpAIService ?? undefined,
      adapter: this.adapter,
      // SharedServiceContext.has() implementation
      // Checks availability of optional services. Core services (variable, template, messenger) are always available.
      has: (service: "memory" | "crm" | "mindstate" | "tag" | "dlq" | "expression" | "followUp" | "cache" | "journey"): boolean => {
        switch (service) {
          case "memory":
            return !!memory;
          case "crm":
            return !!crm;
          case "mindstate":
            return !!mindstate;
          case "tag":
            return !!tag; // Tag service is always created in engine context
          case "expression":
            return true; // Expression service is always available in engine context
          // Services not directly available in engine context:
          case "dlq":
            return false; // DLQ is handled via onFailedEvent callback, not as a service
          case "followUp":
            return false; // Follow-ups are handled by plugin handler, not as a service
          case "cache":
            return false; // Cache service not wired in engine context
          case "journey":
            return false; // Journey service not wired in engine context
          default: {
            // Exhaustiveness check - ensures all service names are handled
            const _exhaustive: never = service;
            return false;
          }
        }
      },
    };
  }

  private createEventLogger(): EventLogger {
    return {
      logEvent: (event: Omit<InteractionEvent, "id" | "timestamp">): InteractionEvent => {
        const fullEvent: InteractionEvent = {
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          ...event,
        };
        this.stateManager.addHistoryEvent(fullEvent);
        this.applyHistoryRetention();
        this.log.debug({ eventType: event.type, nodeId: event.nodeId, payload: event.payload }, "engine:event");

        if (this.onEventCallback) {
          try {
            this.onEventCallback(fullEvent);
          } catch (error) {
            this.log.error({ err: serializeError(error), eventType: event.type }, "engine:eventCallbackError");
          }
        }

        return fullEvent;
      },
    };
  }

  private applyHistoryRetention(): void {
    if (!this.historyRetention) return;

    const { maxEvents, maxAgeMs, onTrim } = this.historyRetention;
    const history = this.session.history;
    const removed: InteractionEvent[] = [];

    if (maxAgeMs && history.length > 0) {
      const cutoff = Date.now() - maxAgeMs;
      let trimIndex = 0;
      while (trimIndex < history.length) {
        const timestamp = Date.parse(history[trimIndex].timestamp);
        if (!Number.isNaN(timestamp) && timestamp >= cutoff) {
          break;
        }
        trimIndex += 1;
      }
      if (trimIndex > 0) {
        removed.push(...history.splice(0, trimIndex));
      }
    }

    if (maxEvents && history.length > maxEvents) {
      const overflow = history.length - maxEvents;
      removed.push(...history.splice(0, overflow));
    }

    if (removed.length > 0 && onTrim) {
      try {
        const result = onTrim({ removed, retained: [...history] });
        if (result && typeof (result as Promise<void>).then === "function") {
          (result as Promise<void>).catch((error) => {
            this.log.warn(
              { error: error instanceof Error ? error.message : String(error) },
              "engine:historyRetention:onTrimFailed"
            );
          });
        }
      } catch (error) {
        this.log.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "engine:historyRetention:onTrimFailed"
        );
      }
    }
  }

  private createTagService(): TagService {
    const userId = this.session.userId;

    return {
      executeTagAction: async (add?: string[], remove?: string[]): Promise<void> => {
        const hasAdd = add && add.length > 0;
        const hasRemove = remove && remove.length > 0;

        if (!hasAdd && !hasRemove) return;

        if (this.onTagOperationCallback) {
          try {
            await this.onTagOperationCallback(userId, { add, remove });
            this.log.info({ nodeId: this.session.currentNodeId, userId, add, remove }, "engine:tagActionExecuted");
          } catch (error) {
            this.log.error({ err: serializeError(error), userId, add, remove }, "engine:tagActionError");
          }
        } else {
          let currentTags = [...(this.session.tags || [])];
          if (hasRemove) {
            currentTags = currentTags.filter((tag) => !remove!.includes(tag));
          }
          if (hasAdd) {
            for (const tag of add!) {
              if (!currentTags.includes(tag)) {
                currentTags.push(tag);
              }
            }
          }
          this.stateManager.setTags(currentTags);
          this.log.info({ nodeId: this.session.currentNodeId, add, remove, resultTags: currentTags }, "engine:tagActionApplied:fallback");
        }
      },

      getTags: async (): Promise<string[]> => {
        if (this.onGetTagsCallback) {
          try {
            const tags = await this.onGetTagsCallback(userId);
            this.log.debug({ userId, tagCount: tags.length }, "engine:getTags");
            return tags;
          } catch (error) {
            this.log.error({ err: serializeError(error), userId }, "engine:getTags:error");
            return [];
          }
        }
        return this.session.tags || [];
      },
    };
  }

  private createMessengerService(template: TemplateService, variable: VariableService, eventLogger: EventLogger): MessengerService {
    return {
      sendMessage: async (
        content: string,
        buttons?: ButtonConfig[],
        media?: { type: "image" | "video"; url: string; mediaId?: string },
        prebuiltContext?: Record<string, unknown>,
        options?: SendMessageOptions
      ): Promise<SendMessageResult> => {
        // Use prebuilt context if provided, otherwise fetch variables
        // Prebuilt context avoids 3 async calls when handler already has context from EdgeSelector
        let evalContext: Record<string, unknown>;

        if (prebuiltContext) {
          evalContext = prebuiltContext;
        } else {
          // Fallback: fetch all variable scopes for template substitution
          const [journeyVars, globalVars, userVars] = await Promise.all([
            variable.getAll("journey"),
            variable.getAll("global"),
            variable.getAll("user"),
          ]);

          // Fetch mindstate if configured and service is available
          let mindstate: MindstateNamespace | undefined;
          const mindstateKeys = this.mindstateConfig?.keys;
          if (mindstateKeys && mindstateKeys.length > 0 && this.mindstateService) {
            mindstate = await buildMindstateNamespace(this.mindstateService, this.session.userId, mindstateKeys);
          }

          evalContext = buildFullContext({
            session: this.session,
            client: this.clientData ?? undefined,
            journeyVars,
            globalVars,
            userVars,
            mindstate,
          });
        }

        const processedContent = template.substitute(content, evalContext);
        const messageType = buttons?.length ? "buttons" : media ? "media" : "text";

        // Determine if voice output is needed based on voice.mode and last user input type
        let outputAsVoice = false;
        if (options?.voice?.mode) {
          if (options.voice.mode === "voice-only") {
            outputAsVoice = true;
          } else if (options.voice.mode === "voice-to-voice") {
            // Check session history for last user message's inputType
            const lastUserEvent = [...this.session.history]
              .reverse()
              .find((e) => e.type === "user.message");
            const lastInputType = (lastUserEvent?.payload as { inputType?: string })?.inputType;
            outputAsVoice = lastInputType === "voice";
          }
        }

        // Log voice selection decision for debugging
        if (options?.voice?.mode) {
          const lastUserEvent = [...this.session.history].reverse().find((e) => e.type === "user.message");
          const lastInputType = (lastUserEvent?.payload as { inputType?: string })?.inputType;
          this.log.debug(
            {
              voiceMode: options.voice.mode,
              voiceProvider: options.voice.provider,
              voiceProfile: options.voice.profile,
              elevenLabsModel: options.voice.elevenLabsModel,
              lastInputType,
              outputAsVoice,
            },
            "messenger:voiceSelectionDecision"
          );
        }

        const message: JourneyMessage = {
          type: messageType,
          content: processedContent,
          buttons: buttons?.map((btn) => ({ id: btn.id, label: btn.text })),
          media: media ? { type: media.type, url: media.url, mediaId: media.mediaId } : undefined,
          voice: outputAsVoice ? options?.voice : undefined,
        };

        const result = await withRetry(
          () => this.adapter.sendMessage(this.session.platformUserId, message),
          (r) => r.success,
          {
            maxAttempts: 3,
            baseDelayMs: 1000,
            maxDelayMs: 4000,
            onError: (error) => ({
              success: false,
              messageIds: [],
              error: error instanceof Error ? error.message : String(error),
            }),
          },
          this.log
        );

        this.log.debug(
          {
            nodeId: this.session.currentNodeId,
            adapterType: this.adapter.adapterType,
            hasButtons: !!buttons?.length,
            hasMedia: !!media,
            hasTemplates: content !== processedContent,
            messageIds: result.messageIds,
            success: result.success,
          },
          "engine:sendMessage"
        );

        if (result.success) {
          const messagePayload = {
            content: processedContent,
            ...(message.buttons ? { buttons: message.buttons } : {}),
            ...(message.media ? { media: message.media } : {}),
          };

          // STEP 1: Log interaction event FIRST to get its ID
          const interactionEvent = eventLogger.logEvent({
            type: EventTypes.ENGINE_MESSAGE,
            nodeId: this.session.currentNodeId,
            payload: messagePayload,
          });

          // STEP 2: Create sent_messages with interaction reference
          if (result.messageIds.length > 0 && this.onMessageSentCallback) {
            try {
              await this.onMessageSentCallback({
                sessionId: this.session.sessionId,
                nodeId: this.session.currentNodeId,
                platform: this.adapter.adapterType,
                chatId: this.session.platformUserId,
                content: processedContent,
                messages: result.messageIds,
                interactionEventId: interactionEvent.id,
              });
            } catch (error) {
              this.log.error(
                { err: serializeError(error), interactionEventId: interactionEvent.id },
                "engine:onMessageSent:error"
              );
            }
          }
        } else {
          this.log.error(
            {
              nodeId: this.session.currentNodeId,
              adapterType: this.adapter.adapterType,
              error: result.error,
            },
            "engine:sendMessage:failed"
          );
        }

        return result;
      },
    };
  }

  private createCrmServiceWrapper(crmService: CrmService): CrmService {
    return {
      updateClientPosition: async (clientId: string, pipelineId?: string, stageId?: string, notes?: string) => {
        const resolvedPipelineId = pipelineId || this.defaultPipelineId || undefined;
        return crmService.updateClientPosition(clientId, resolvedPipelineId, stageId, notes);
      },
      addToPipeline: async (clientId: string, pipelineId?: string, stageId?: string, notes?: string) => {
        const resolvedPipelineId = pipelineId || this.defaultPipelineId || undefined;
        return crmService.addToPipeline(clientId, resolvedPipelineId, stageId, notes);
      },
      moveToStage: crmService.moveToStage.bind(crmService),
      removeFromPipeline: crmService.removeFromPipeline.bind(crmService),
    };
  }

  private createMindstateServiceWrapper(mindstateService: MindstateService): MindstateService {
    if (!this.organizationId) {
      this.log.warn({}, "engine:mindstateService:noOrganizationId");
    }

    return {
      getOrCreateMindstate: async (clientId: string, mindstateKey: string) => {
        return mindstateService.getOrCreateMindstate(clientId, mindstateKey);
      },
      analyzeMessage: async (clientMindstateId: string, message: string, sessionId?: string) => {
        return mindstateService.analyzeMessage(clientMindstateId, message, sessionId);
      },
      getParameterValue: async (clientId: string, mindstateKey: string, parameterName: string) => {
        return mindstateService.getParameterValue(clientId, mindstateKey, parameterName);
      },
      getMultipleParameterValues: async (clientId: string, queries: Array<{ mindstateKey: string; parameterName: string }>) => {
        return mindstateService.getMultipleParameterValues(clientId, queries);
      },
      setParameterValue: async (
        clientId: string,
        mindstateKey: string,
        parameterName: string,
        value: import("@journey/schemas").StateParameterValue,
        reasoning?: string
      ) => {
        return mindstateService.setParameterValue(clientId, mindstateKey, parameterName, value, reasoning);
      },
    };
  }
}
