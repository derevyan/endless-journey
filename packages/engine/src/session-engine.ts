/**
 * Session Engine
 *
 * The core orchestrator for journey execution. This is a coordinator that:
 * - Initializes and wires together all services
 * - Routes events to the appropriate handlers
 * - Manages session state transitions
 * - Delegates all business logic to handlers and services
 *
 * The engine follows the Strategy pattern - each node type has its own handler,
 * making it easy to add new node types without modifying the core engine.
 */

import { createLogger, serializeError } from "@journey/logger";
import {
  EventTypes,
  type EnhancedUserJourney,
  type JourneyConfig,
  type JourneyEdgeData,
  type JourneyMindstateConfig,
  type JourneyNodeData,
  nodeVersionRegistry,
} from "@journey/schemas";
import { EventQueue, EventRouter } from "./event";
import { createHandlerRegistryWithOverrides, HandlerRegistry } from "./handlers";
import { createLifecycleManager, type NodeLifecycleManager } from "./lifecycle";
import { MindstateAnalyzer } from "./mindstate";
import { createMiddlewarePipeline, MiddlewarePipeline } from "./middleware";
import { createPluginOrchestrator, type PluginOrchestrator } from "./plugins/plugin-orchestrator";
import { createDlqService, type DlqService } from "./services/dlq-service";
import { ServiceFactory } from "./services/service-factory";
import { createSessionStateManager, type SessionStateManager } from "./state/session-state-manager";
import { createStateMethods } from "./utils";
import { validateJourneyStructure } from "./validation/journey-validator";
import { GraphIndex } from "./graph-index";
import { createMigrationRunner, type MigrationRunner } from "./version/migration-runner";
import type {
  ClientData,
  EngineServices,
  ExecutionContext,
  HandlerResult,
  JourneyEvent,
  MessagingAdapter,
  SessionEngineConfig,
} from "./types";

/**
 * SessionEngine - Journey execution coordinator
 *
 * @example
 * ```ts
 * import { createLogger } from "@journey/logger";
 * const log = createLogger("engine");
 *
 * const engine = new SessionEngine(session, journey, adapter, {
 *   onEvent: (event) => log.info({ eventType: event.type }, "engine:event"),
 * });
 * await engine.start();
 * ```
 */
export class SessionEngine {
  private session: EnhancedUserJourney;
  private journey: JourneyConfig;
  private adapter: MessagingAdapter;
  private log: ReturnType<typeof createLogger>;

  // Graph index for O(1) node/edge lookups
  private graphIndex: GraphIndex;

  // State manager for centralized session mutations
  private stateManager: SessionStateManager;

  // Services
  private services: EngineServices;
  private handlerRegistry: HandlerRegistry;
  private pluginOrchestrator: PluginOrchestrator;
  private lifecycleManager: NodeLifecycleManager;
  private migrationRunner: MigrationRunner;

  // Middleware pipeline (replaces individual processors)
  private middlewarePipeline: MiddlewarePipeline;

  // Callbacks & Config (Retained for ServiceFactory usage if needed, but mostly moved)
  private clientData: ClientData | null = null;
  private organizationId: string | undefined = undefined;
  private onMessageSentCallback: SessionEngineConfig["onMessageSent"] | null = null;
  private mindstateConfig: JourneyMindstateConfig | null = null;
  private mindstateAnalyzer: MindstateAnalyzer | null = null;
  private eventRouter: EventRouter;
  private eventQueue: import("./event/event-queue").EventQueueLike;
  private dlq: DlqService;
  private onMessageHandler: ((event: JourneyEvent) => Promise<void>) | null = null;
  private validateOnStartConfig: boolean | { strict?: boolean } | undefined;
  private maxLoopIterations: number;

  /**
   * Lifecycle flag - set to true when destroy() is called.
   * Prevents processing events after engine teardown.
   */
  private disposed = false;

  constructor(session: EnhancedUserJourney, journey: JourneyConfig, adapter: MessagingAdapter, config?: SessionEngineConfig) {
    this.session = session;
    this.journey = journey;
    this.adapter = adapter;

    const cfg = config || {};

    this.clientData = cfg.clientData || null;
    this.organizationId = cfg.organizationId;
    this.onMessageSentCallback = cfg.onMessageSent || null;
    this.mindstateConfig = cfg.mindstateConfig || null;
    this.validateOnStartConfig = cfg.validateOnStart;
    this.maxLoopIterations = cfg.maxLoopIterations ?? 100;
    this.log =
      cfg.logger ??
      createLogger("engine", {
        sessionId: session.sessionId,
        journeyId: session.journeyId,
        adapterType: adapter.adapterType,
      });

    this.migrationRunner = createMigrationRunner(nodeVersionRegistry, this.log);
    const migratedJourney = this.migrationRunner.migrateJourney(journey);
    this.journey = migratedJourney;

    // Build graph index for O(1) node/edge lookups
    // Use pre-built index if provided (for testing performance)
    const migrationsApplied = migratedJourney !== journey;
    if (migrationsApplied) {
      this.graphIndex = new GraphIndex(migratedJourney);
      if (cfg.graphIndex) {
        this.log.warn({ journeyId: this.session.journeyId }, "engine:migration:graphIndexRebuilt");
      }
    } else {
      this.graphIndex = cfg.graphIndex ?? new GraphIndex(migratedJourney);
    }

    // Create state manager for centralized session mutations
    this.stateManager = createSessionStateManager(session);

    // Initialize Service Factory with state manager
    const serviceFactory = new ServiceFactory(session, this.stateManager, adapter, cfg, this.log);

    // Initialize services
    this.services = serviceFactory.createServices((nodeId) => this.getOutgoingEdges(nodeId));
    // Use pre-built registry if provided (for testing performance)
    this.handlerRegistry =
      cfg.handlerRegistry ??
      createHandlerRegistryWithOverrides({
        customHandlers: cfg.customHandlers,
        handlerOverrides: cfg.handlerOverrides,
      });

    this.lifecycleManager = createLifecycleManager(this.handlerRegistry, this.log);

    // Initialize plugin orchestrator for plugin lifecycle management
    this.pluginOrchestrator = createPluginOrchestrator({
      getSession: () => this.session,
      getStateManager: () => this.stateManager,
      adapter: this.adapter,
      services: this.services,
      graphIndex: this.graphIndex,
      log: this.log,
      organizationId: this.organizationId,
    });

    // Initialize middleware pipeline (replaces individual processors)
    // Built-in middleware priorities defined in middleware/priorities.ts
    this.middlewarePipeline = createMiddlewarePipeline({
      variableConfig: { strictMode: cfg.strictVariableOperations ?? false },
      customMiddleware: cfg.customMiddleware,
      stopOnError: cfg.strictVariableOperations ?? false, // Stop pipeline if strict mode
      logger: this.log,
    });

    // Initialize Dead Letter Queue service for failed event recording
    this.dlq = createDlqService({
      onPersist: cfg.onFailedEvent,
      logger: this.log,
    });

    if (this.mindstateConfig && this.services.mindstate) {
      this.mindstateAnalyzer = new MindstateAnalyzer({
        mindstateConfig: this.mindstateConfig,
        mindstateService: this.services.mindstate,
        eventLogger: this.services.eventLogger,
        log: this.log,
        sessionHistory: this.session.history,
      });
    }

    // Trace: Log engine initialization
    this.log.trace(
      {
        sessionId: session.sessionId,
        journeyId: session.journeyId,
        currentNodeId: session.currentNodeId,
        status: session.status,
        nodeCount: this.journey.nodes.length,
        edgeCount: this.journey.edges.length,
        hasMindstate: !!this.mindstateConfig,
        hasCrm: !!this.services.crm,
      },
      "engine:trace:init"
    );

    // Initialize event router
    this.eventRouter = new EventRouter(
      {
        session: this.session,
        stateManager: this.stateManager,
        eventLogger: this.services.eventLogger,
        timerService: this.services.timer,
        messengerService: this.services.messenger,
        log: this.log,
      },
      {
        getNode: (id) => this.getNode(id),
        getOutgoingEdges: (nodeId) => this.getOutgoingEdges(nodeId),
        onTransition: (targetNodeId, trigger, buttonId) => this.transition(targetNodeId, trigger, buttonId),
        onMindstateAnalysis: this.mindstateAnalyzer
          ? async (message, nodeId) => {
              await this.mindstateAnalyzer!.analyze({
                userMessage: message,
                currentNodeId: nodeId,
                userId: this.session.userId,
                sessionId: this.session.sessionId,
                getNode: (id) => this.getNode(id),
              });
            }
          : undefined,
        // Re-execute current node (for questionnaire progress)
        onReExecuteNode: async () => {
          await this.executeLoop(this.session.currentNodeId);
        },
        // Get client data for guard context (user namespace in expression guards)
        getClientData: () => this.clientData ?? undefined,
        // Get handler for delegation pattern (Phase 3)
        getHandler: (nodeType) => this.handlerRegistry.get(nodeType),
        // Get services for building execution context
        getServices: () => this.services,
        // Handle plugin follow-up timeout (delegated to PluginOrchestrator)
        onPluginTimeout: async (timerId) => {
          const result = await this.pluginOrchestrator.handlePluginTimeout(timerId);
          // Map PluginTimeoutResult to PluginTimeoutCallbackResult
          // "complete" means stay on node, same as "continue"
          if (result.action === "complete") {
            return { action: "continue" };
          }
          return result;
        },
      }
    );

    // Initialize event queue for serialized event processing
    // This prevents race conditions when timeout and user events arrive simultaneously
    // The queue uses catch-and-continue pattern with DLQ for failed events
    const eventQueueFactory =
      cfg.eventQueueFactory ??
      ((processEvent, queueConfig) => new EventQueue(processEvent, queueConfig));
    this.eventQueue = eventQueueFactory(
      async (event) => {
        // Check disposed flag to prevent processing after destroy()
        if (this.disposed) {
          this.log.debug({ eventType: event.type }, "engine:event:ignored:disposed");
          return;
        }
        await this.eventRouter.handle(event);
      },
      {
        log: this.log,
        dlq: this.dlq,
        dlqContext: {
          sessionId: session.sessionId,
          journeyId: session.journeyId,
          organizationId: cfg.organizationId,
          getCurrentNodeId: () => this.session.currentNodeId,
          getSessionContext: () => this.session.context,
        },
        ...cfg.eventQueueConfig,
      }
    );

    // Set up message handler - events go through queue for serialization
    // EventQueue now uses catch-and-continue pattern, so errors are handled internally
    // and recorded to DLQ - we no longer need to wrap in try-catch here
    this.onMessageHandler = async (event) => {
      // Check disposed flag to prevent enqueuing events after destroy()
      if (this.disposed) {
        this.log.debug({ eventType: event.type }, "engine:event:rejected:disposed");
        return;
      }
      await this.eventQueue.enqueue(event);
    };
    this.adapter.onMessage(this.onMessageHandler);
  }

  /**
   * Check if the engine has been destroyed
   * @returns true if destroy() has been called
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Cleanup resources when engine is no longer needed
   * Call this to prevent memory leaks if adapter outlives the engine
   */
  async destroy(): Promise<void> {
    // Set disposed flag FIRST to prevent any new events from being processed
    this.disposed = true;

    if (this.onMessageHandler && this.adapter.offMessage) {
      this.adapter.offMessage(this.onMessageHandler);
    }
    this.onMessageHandler = null;

    // Clear event queue to prevent processing queued events during cleanup
    this.eventQueue.clear();

    // Cancel all pending timers for this session in parallel
    await Promise.all(
      this.session.pendingTimers.map((timer) => this.services.timer.cancelTimer(timer.timerId))
    );

    // Cancel all plugin follow-up timers via adapter to prevent stray events after teardown
    await this.services.timer.cancelAllPluginFollowUps();

    // Clear timer map to prevent memory leak
    this.services.timer.clearAll();

    if (this.adapter.dispose) {
      await this.adapter.dispose();
    }

    this.log.debug({}, "engine:destroyed");
  }

  /**
   * Activate the journey (call lifecycle hooks).
   * Intended to be called when a journey is published/enabled.
   */
  async activate(journey: JourneyConfig = this.journey) {
    return this.lifecycleManager.activateJourney(
      journey,
      this.services,
      this.session.journeyId,
      this.organizationId
    );
  }

  /**
   * Deactivate the journey (call cleanup hooks).
   * Intended to be called when a journey is unpublished/disabled.
   */
  async deactivate(journey: JourneyConfig = this.journey) {
    return this.lifecycleManager.deactivateJourney(
      journey,
      this.services,
      this.session.journeyId,
      this.organizationId
    );
  }

  /**
   * Start the journey execution
   *
   * Handles two cases:
   * 1. Initial start (new session): Find start node, initialize session, execute node
   * 2. Resume (existing session): Just return - event handler will process incoming events
   */
  async start(): Promise<void> {
    // Run optional validation preflight
    if (this.validateOnStartConfig) {
      const validationResult = validateJourneyStructure(this.journey);
      const isStrict = typeof this.validateOnStartConfig === "object" && this.validateOnStartConfig.strict;

      // Log warnings (always)
      for (const warning of validationResult.warnings) {
        this.log.warn(
          { code: warning.code, nodeId: warning.nodeId, edgeId: warning.edgeId, message: warning.message },
          "engine:validation:warning"
        );
      }

      // Log errors
      for (const error of validationResult.errors) {
        this.log.error(
          { code: error.code, nodeId: error.nodeId, edgeId: error.edgeId, message: error.message },
          "engine:validation:error"
        );
      }

      // In strict mode, throw if there are errors
      if (isStrict && !validationResult.valid) {
        const errorMessages = validationResult.errors.map((e) => `${e.code}: ${e.message}`).join("; ");
        throw new Error(`Journey validation failed: ${errorMessages}`);
      }

      this.log.info(
        {
          valid: validationResult.valid,
          errorCount: validationResult.errors.length,
          warningCount: validationResult.warnings.length,
          strict: isStrict,
        },
        "engine:validation:complete"
      );
    }

    // Detect if this is a session resume vs initial start
    // Use hasStarted field (deterministic, set by initializeSession)
    const hasStartedMarker = this.session.hasStarted === true;
    const isResume = hasStartedMarker;

    this.log.debug(
      {
        sessionId: this.session.sessionId,
        hasStartedMarker,
        currentNodeId: this.session.currentNodeId,
        isResume,
      },
      "engine:start:resumeDetection"
    );

    // Use existing currentNodeId if set, otherwise find start node
    let startNodeId = this.session.currentNodeId;

    if (!startNodeId) {
      const startNode = this.journey.nodes.find((node: JourneyNodeData) => node.data.type === "start");
      if (!startNode) {
        throw new Error("No start node found in journey");
      }
      startNodeId = startNode.id;
    }

    // Verify the node exists
    const startNode = this.getNode(startNodeId);
    if (!startNode) {
      throw new Error(`Start node ${startNodeId} not found in journey`);
    }

    // For resume: don't re-execute the node, just wait for events
    if (isResume) {
      this.log.info(
        {
          nodeId: startNodeId,
          sessionId: this.session.sessionId,
          nodeType: startNode.data.type,
        },
        "engine:resumed"
      );
      return;
    }

    // Fresh start: execute the start node handler
    this.log.info(
      {
        nodeId: startNodeId,
        sessionId: this.session.sessionId,
        nodeType: startNode.data.type,
      },
      "engine:started"
    );

    // Trace: Log start with full node data
    this.log.trace(
      {
        startNodeId,
        nodeType: startNode.data.type,
        nodeLabel: startNode.data.label,
        sessionContext: this.session.context,
        sessionTags: this.session.tags,
      },
      "engine:trace:start"
    );

    // Initialize session (only on initial start)
    this.stateManager.initializeSession(startNodeId);
    this.log.info({ startNodeId }, "engine:start");

    // Log session start
    this.services.eventLogger.logEvent({
      type: EventTypes.ENGINE_TRANSITION,
      nodeId: startNodeId,
      payload: { from: null, to: startNodeId, trigger: "start" },
    });

    // Execute start node (only on initial start)
    await this.executeLoop(startNodeId);
  }

  /**
   * Perform state updates and logging for a transition
   * Does NOT execute the new node
   * @returns true if transition was applied, false if blocked (e.g., by terminal state)
   */
  private async performTransitionStateUpdate(targetNodeId: string, trigger: string, buttonId?: string): Promise<boolean> {
    const fromNodeId = this.session.currentNodeId;
    const fromNode = this.getNode(fromNodeId);
    const toNode = this.getNode(targetNodeId);

    if (!toNode) {
      this.log.warn({ targetNodeId, trigger }, "engine:transition:nodeNotFound");
      return false;
    }

    // Trace: Log transition with full context
    this.log.trace(
      {
        from: fromNodeId,
        fromType: fromNode?.data.type,
        fromLabel: fromNode?.data.label,
        to: targetNodeId,
        toType: toNode.data.type,
        toLabel: toNode.data.label,
        trigger,
        buttonId,
        contextBefore: this.session.context,
        pendingTimers: this.session.pendingTimers.length,
      },
      "engine:trace:transition"
    );

    // Log transition - include buttonId when available for precise edge matching in simulator
    this.services.eventLogger.logEvent({
      type: EventTypes.ENGINE_TRANSITION,
      nodeId: fromNodeId,
      payload: {
        from: fromNodeId,
        to: targetNodeId,
        trigger,
        ...(buttonId && { buttonId }),
      },
    });
    this.log.info({ from: fromNodeId, to: targetNodeId, trigger, buttonId }, "engine:transition");

    // Update session state via state manager and check if transition was applied
    const result = this.stateManager.transitionToNode(targetNodeId);
    if (!result.applied) {
      this.log.warn(
        { targetNodeId, reason: result.reason, status: this.session.status },
        "engine:transitionBlocked"
      );
      return false;
    }
    return true;
  }

  /**
   * Execute nodes in a loop to handle auto-transitions iteratively
   * Replaces recursive calls to prevent stack overflow
   */
  private async executeLoop(startNodeId: string): Promise<void> {
    // Guard: Don't execute if session is in terminal state
    if (this.session.status === "completed" || this.session.status === "dropped") {
      this.log.warn(
        { status: this.session.status, nodeId: startNodeId },
        "engine:executeLoop:terminalState"
      );
      return;
    }

    let currentNodeId = startNodeId;
    let loopCount = 0;

    // Pre-calculate warning threshold (50% of max)
    const warningThreshold = Math.floor(this.maxLoopIterations * 0.5);
    let hasLoggedWarning = false;

    while (true) {
      loopCount++;

      // Early warning at 50% of max iterations - helps diagnose potential infinite loops
      if (!hasLoggedWarning && loopCount >= warningThreshold) {
        this.log.warn(
          { currentNodeId, loopCount, maxLoopIterations: this.maxLoopIterations, warningThreshold },
          "engine:executeLoop:approachingMaxIterations"
        );
        hasLoggedWarning = true;
      }

      // Safety check for infinite loops (configurable via maxLoopIterations)
      if (loopCount > this.maxLoopIterations) {
        this.log.error({ currentNodeId, loopCount }, "engine:executeLoop:maxIterationsExceeded");
        this.stateManager.setStatus("error");
        this.services.eventLogger.logEvent({
          type: EventTypes.ENGINE_ERROR,
          nodeId: currentNodeId,
          payload: { message: "Maximum loop iterations exceeded", code: "max_loop_iterations_exceeded" },
        });
        break;
      }

      // Execute the current node
      const result = await this.executeNode(currentNodeId);

      // Handle the result
      if (result.action === "transition") {
        const fromNodeId = currentNodeId;

        // Cancel plugin follow-ups from the node we're leaving
        // This ensures cancelOnAnyResponse: true works for handlers like questionnaire/agent
        // that return "transition" from execute() rather than handleEvent()
        if (this.services.timer.shouldCancelPluginFollowUpsOnResponse(fromNodeId)) {
          await this.services.timer.cancelPluginFollowUpsForNode(fromNodeId);
        }

        // Perform state update for the transition
        await this.performTransitionStateUpdate(result.targetNodeId, result.trigger);

        // Update current node ID for next iteration
        currentNodeId = result.targetNodeId;

        // Continue loop to execute the new node
        continue;
      } else {
        // "wait" or "complete" - stop the loop
        break;
      }
    }
  }

  /**
   * Transition to a new node and start execution loop.
   *
   * @param targetNodeId - The node to transition to
   * @param trigger - Event type that triggered transition (message, button_click, timeout, etc.)
   * @param buttonId - Clicked button ID (only for button_click triggers).
   *                   Used for precise edge matching in simulators when multiple edges connect same nodes.
   */
  private async transition(targetNodeId: string, trigger: string, buttonId?: string): Promise<void> {
    const stateUpdated = await this.performTransitionStateUpdate(targetNodeId, trigger, buttonId);
    if (!stateUpdated) {
      // Transition was blocked (e.g., terminal state) - don't execute loop
      return;
    }
    await this.executeLoop(targetNodeId);
  }

  /**
   * Execute a node using its handler
   */
  private async executeNode(nodeId: string): Promise<HandlerResult> {
    const node = this.getNode(nodeId);
    if (!node) {
      this.log.warn({ nodeId }, "engine:executeNode:nodeNotFound");
      return { action: "wait" }; // Default safe action
    }

    const nodeType = node.data.type;
    const outgoingEdges = this.getOutgoingEdges(nodeId);

    // Trace: Log node entry with full data
    this.log.trace(
      {
        nodeId,
        nodeType,
        nodeLabel: node.data.label,
        nodeData: node.data,
        outgoingEdgeCount: outgoingEdges.length,
        outgoingEdges: outgoingEdges.map((e) => ({
          id: e.id,
          target: e.target,
          label: e.label,
          edgeType: e.edgeType,
        })),
      },
      "engine:trace:nodeEntry"
    );

    this.log.debug({ nodeId, type: nodeType }, "engine:executeNode");

    // Track visited nodes for mindstate after_node start condition
    this.mindstateAnalyzer?.trackVisitedNode(nodeId);

    // Get handler for node type
    const handler = this.handlerRegistry.get(nodeType);
    if (!handler) {
      this.log.error({ nodeId, type: nodeType }, "engine:noHandlerForNodeType");
      return { action: "wait" };
    }

    // Trace: Log handler selection
    this.log.trace({ nodeId, nodeType, handlerType: handler.nodeType }, "engine:trace:handlerSelected");

    // Build execution context with state management methods
    const context: ExecutionContext = {
      session: this.session,
      stateManager: this.stateManager,
      node,
      journey: this.journey,
      outgoingEdges,
      services: this.services,
      log: this.log,
      clientData: this.clientData || undefined,
      organizationId: this.organizationId,
      mindstateConfig: this.mindstateConfig || undefined,
      // State management methods for stateful handlers (questionnaire, agent)
      ...createStateMethods(this.session, node.id, node.data.type, this.stateManager),
    };

    // Execute handler with error boundary
    let result: HandlerResult;
    try {
      result = await handler.execute(context);
    } catch (error) {
      // Engine-level error boundary: log error and set session to error state
      this.log.error(
        { err: serializeError(error), nodeId, nodeType },
        "engine:handler:error"
      );
      this.services.eventLogger.logEvent({
        type: EventTypes.ENGINE_ERROR,
        nodeId,
        payload: {
          message: error instanceof Error ? error.message : String(error),
          code: "handler_error",
        },
      });
      this.stateManager.setStatus("error");
      return { action: "wait" };
    }

    // Trace: Log handler result
    this.log.trace(
      {
        nodeId,
        nodeType,
        resultAction: result.action,
        targetNodeId: result.action === "transition" ? result.targetNodeId : undefined,
        trigger: result.action === "transition" ? result.trigger : undefined,
      },
      "engine:trace:handlerResult"
    );

    // Execute middleware pipeline (tags, variables, CRM, custom middleware)
    // Middleware runs after handler completes to apply side effects
    try {
      await this.middlewarePipeline.execute(node, context, result);
    } catch (error) {
      // Pipeline error in strict mode - log and set session to error state
      this.log.error(
        { nodeId, nodeType, error: error instanceof Error ? error.message : String(error) },
        "engine:middlewarePipeline:error"
      );
      this.stateManager.setStatus("error");
      return { action: "wait" };
    }

    // Invoke attached plugins for "wait" nodes (e.g., message nodes with follow-up plugins)
    // This schedules follow-up timers after the node has displayed and is waiting for user input
    if (result.action === "wait") {
      await this.pluginOrchestrator.invokePlugins(node, context);
    }

    return result;
  }

  /**
   * Get a node by ID
   */
  private getNode(nodeId: string): JourneyNodeData | undefined {
    return this.graphIndex.getNode(nodeId);
  }

  /**
   * Get outgoing edges for a node
   */
  private getOutgoingEdges(nodeId: string): JourneyEdgeData[] {
    return this.graphIndex.getOutgoingEdges(nodeId);
  }

  /**
   * Get current session state
   */
  getSession(): EnhancedUserJourney {
    return this.session;
  }

  /**
   * Get the messaging adapter instance
   */
  getAdapter(): MessagingAdapter {
    return this.adapter;
  }

  /**
   * Inject an event into the engine's event queue
   *
   * Used by timer handlers to trigger timeout events through the normal
   * event routing infrastructure. This allows both regular wait timers
   * and follow-up timers to be processed correctly.
   *
   * @param event - The journey event to inject
   */
  async injectEvent(event: JourneyEvent): Promise<void> {
    await this.eventQueue.enqueue(event);
  }

  /**
   * Force a transition through a specific edge (for testing timer paths)
   */
  async forceEdgeTransition(edgeId: string): Promise<void> {
    const edge = this.graphIndex.getEdge(edgeId);
    if (!edge) {
      this.log.warn({ edgeId }, "engine:forceEdgeTransition:edgeNotFound");
      return;
    }

    const currentNode = this.getNode(this.session.currentNodeId);
    if (!currentNode || edge.source !== currentNode.id) {
      this.log.warn({ edgeId, currentNodeId: this.session.currentNodeId }, "engine:forceEdgeTransition:invalidEdge");
      return;
    }

    // Trace: Log forced edge transition
    this.log.trace(
      {
        edgeId,
        edgeLabel: edge.label,
        edgeType: edge.edgeType,
        source: edge.source,
        target: edge.target,
        currentNodeId: this.session.currentNodeId,
        currentNodeType: currentNode.data.type,
      },
      "engine:trace:forceEdgeTransition"
    );

    // Cancel any pending timers for current node
    const outgoingEdgeIds = new Set(this.getOutgoingEdges(currentNode.id).map((e) => e.id));
    const timersToCancel = this.session.pendingTimers.filter((timer) => outgoingEdgeIds.has(timer.targetEdgeId));

    // Cancel timers first (in parallel), then update state via state manager
    await Promise.all(
      timersToCancel.map((timer) => this.services.timer.cancelTimer(timer.timerId))
    );
    this.stateManager.removePendingTimersByEdges(outgoingEdgeIds);

    // Transition to target node
    await this.transition(edge.target, "manual_timer_trigger");
  }
}
