/**
 * Variation Runner
 *
 * Executes test variations against the SessionEngine.
 * Each variation is run in isolation with its own MockMessagingAdapter.
 *
 * @module engine/testing/variation-runner
 */

import { createLogger } from "@journey/logger";
import type { JourneyConfig, EnhancedUserJourney, MessageNodeData, QuestionnaireNodeData, AgentWorkflow } from "@journey/schemas";
import type { AgentWorkflowService } from "../types";
import { SessionEngine } from "../session-engine";
import { MockMessagingAdapter } from "../validation/mock-adapter";
import { isTimerEdge, scaleDuration, setSleepScale } from "../utils";
import { GraphIndex } from "../graph-index";
import { createHandlerRegistryWithOverrides, type HandlerRegistry } from "../handlers";
import type {
  TestVariation,
  VariationResult,
  VariationStep,
  VariationRunnerOptions,
  NodeInput,
  TimingScenario,
  AlternatePathInfo,
} from "./types";
import { AlternatePathDetector } from "./alternate-path-detector";

// =============================================================================
// MOCK AGENT WORKFLOW SERVICE
// =============================================================================

/**
 * Create a mock agent workflow service for testing.
 * Agent nodes will execute with mock data instead of calling real workflows.
 */
function createMockAgentWorkflowService(): AgentWorkflowService {
  const mockWorkflow: AgentWorkflow = {
    id: "mock-workflow-id",
    orgId: "test-org",
    key: "mock-workflow",
    name: "Mock Workflow",
    status: "active",
    configuration: {
      nodes: [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "end", type: "end", position: { x: 100, y: 0 }, data: {} },
      ],
      edges: [{ id: "e1", source: "start", target: "end" }],
    },
    settings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    initialize: async () => {},
    loadWorkflow: async () => mockWorkflow,
    runWorkflow: async () => ({
      success: true,
      blocked: false,
      response: "[Mock agent response for testing]",
      toolCalls: [],
      trace: [{ nodeId: "mock", nodeType: "agent", durationMs: 1, outHandle: undefined }],
      totalDurationMs: 1,
      variables: {},
    }),
  };
}

// =============================================================================
// VARIATION RUNNER
// =============================================================================

export class VariationRunner {
  private journey: JourneyConfig;
  private options: Required<VariationRunnerOptions>;
  private logger: ReturnType<typeof createLogger>;

  // Cached graph lookups for O(1) access
  private nodeMap: Map<string, typeof this.journey.nodes[0]>;
  private edgesBySource: Map<string, typeof this.journey.edges>;
  private edgesByTarget: Map<string, typeof this.journey.edges>;

  // Alternate path detection
  private alternatePathDetector: AlternatePathDetector;

  // Mock agent workflow service for testing agent nodes
  private mockAgentWorkflowService: AgentWorkflowService;

  // Shared instances for all variations (performance optimization)
  // These are read-only and safe to share across engine instances
  private sharedGraphIndex: GraphIndex;
  private sharedHandlerRegistry: HandlerRegistry;

  constructor(journey: JourneyConfig, options: VariationRunnerOptions = {}) {
    this.journey = journey;
    this.options = {
      concurrency: options.concurrency ?? 500,
      timeout: options.timeout ?? 30000,
      failFast: options.failFast ?? false,
      logLevel: options.logLevel ?? "error",
      timeScale: options.timeScale ?? 1,
    };
    this.logger = createLogger("variation-runner");
    setSleepScale(this.options.timeScale);

    // Pre-build lookup maps for O(1) access (instead of O(n) .find() calls)
    this.nodeMap = new Map(journey.nodes.map((n) => [n.id, n]));
    this.edgesBySource = new Map();
    this.edgesByTarget = new Map();
    for (const edge of journey.edges) {
      if (!this.edgesBySource.has(edge.source)) {
        this.edgesBySource.set(edge.source, []);
      }
      this.edgesBySource.get(edge.source)!.push(edge);
      if (!this.edgesByTarget.has(edge.target)) {
        this.edgesByTarget.set(edge.target, []);
      }
      this.edgesByTarget.get(edge.target)!.push(edge);
    }

    // Initialize alternate path detector
    this.alternatePathDetector = new AlternatePathDetector(journey);

    // Create mock agent workflow service for testing agent nodes
    this.mockAgentWorkflowService = createMockAgentWorkflowService();

    // Create shared instances for all variations (major performance optimization)
    // GraphIndex is read-only and safe to share across engine instances
    this.sharedGraphIndex = new GraphIndex(journey);
    // HandlerRegistry is stateless and safe to share
    this.sharedHandlerRegistry = createHandlerRegistryWithOverrides({});
  }

  setTimeScale(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) {
      return;
    }
    this.options.timeScale = scale;
    setSleepScale(scale);
  }

  /**
   * Run all variations and return results
   */
  async runAll(variations: TestVariation[]): Promise<VariationResult[]> {
    const results: VariationResult[] = [];

    // Run in chunks for concurrency control
    for (let i = 0; i < variations.length; i += this.options.concurrency) {
      const chunk = variations.slice(i, i + this.options.concurrency);
      const chunkResults = await Promise.all(
        chunk.map((variation) => this.runSingle(variation))
      );

      results.push(...chunkResults);

      // Fail fast if enabled
      if (this.options.failFast && chunkResults.some((r) => !r.success)) {
        break;
      }
    }

    return results;
  }

  /**
   * Run a single variation
   */
  async runSingle(variation: TestVariation): Promise<VariationResult> {
    const startTime = Date.now();
    const steps: VariationStep[] = [];
    const visitedNodes: string[] = [];
    const messagesSent: string[] = [];

    // Track session and engine for error handling - may be undefined if setup fails
    let session: EnhancedUserJourney | undefined;
    let engine: SessionEngine | undefined;
    let adapter: MockMessagingAdapter | undefined;

    try {
      // Skip waits only when the path has no async behavior and no timing simulation
      const hasAsyncBehavior = this.pathHasAsyncBehavior(variation.path);
      const shouldSkipWaits = variation.timing === "none" && !hasAsyncBehavior;

      // Create fresh adapter and session for this variation
      adapter = new MockMessagingAdapter({ delayScale: this.options.timeScale });
      session = this.createSession(variation);

      // Configure timing simulation if needed
      this.configureTimingSimulation(adapter, variation.timing);

      // Apply initial context
      session.context = { ...session.context, ...variation.contextSetup };

      engine = new SessionEngine(session, this.journey, adapter, {
        logger: this.logger.child({ variationId: variation.id }),
        agentWorkflowService: this.mockAgentWorkflowService,
        // Use shared instances for performance (avoids re-building per variation)
        graphIndex: this.sharedGraphIndex,
        handlerRegistry: this.sharedHandlerRegistry,
      });
      // Start the engine
      steps.push({
        nodeId: variation.path[0],
        action: "start",
        details: "Engine started",
        timestamp: Date.now(),
      });

      await this.withTimeout(engine.start(), this.options.timeout);

      // Track initial position
      visitedNodes.push(session.currentNodeId);

      // Build a map of inputs by nodeId for quick lookup
      const inputsByNode = new Map<string, NodeInput[]>();
      for (const input of variation.inputs) {
        if (!inputsByNode.has(input.nodeId)) {
          inputsByNode.set(input.nodeId, []);
        }
        inputsByNode.get(input.nodeId)!.push(input);
      }

      // Execute the path
      let pathIndex = 0;
      let safetyCounter = 0;
      const MAX_STEPS = 1000;

      while (session.status === "active" && safetyCounter++ < MAX_STEPS) {
        const currentNodeId = session.currentNodeId;

        // Track visited
        if (visitedNodes[visitedNodes.length - 1] !== currentNodeId) {
          visitedNodes.push(currentNodeId);
        }

        // Collect messages
        const newMessages = adapter.getSentMessages();
        for (const msg of newMessages.slice(messagesSent.length)) {
          messagesSent.push(msg.message.content || "[media/buttons]");
        }

        // Find the current node in our expected path
        const expectedIndex = variation.path.indexOf(currentNodeId, pathIndex);
        if (expectedIndex === -1) {
          // Engine diverged from expected path - this is an error
          // The variation's inputs led to a node not in the expected path
          const expectedNode = variation.path[pathIndex] || variation.path[pathIndex - 1] || "unknown";
          const lastStep = steps[steps.length - 1];
          const lastAction = lastStep ? `${lastStep.action} at ${lastStep.nodeId}` : "start";

          this.logger.debug(
            { currentNodeId, expectedPath: variation.path, pathIndex, expectedNode },
            "runner:pathDivergence"
          );

          // Merge manually tracked nodes with session.history for complete coverage
          const allVisitedNodes = this.mergeVisitedNodes(visitedNodes, session);
          return this.createResult(
            variation,
            false,
            `Path diverged: at node "${currentNodeId}" after ${lastAction}, expected to be at "${expectedNode}". Path: [${variation.path.join(" → ")}]`,
            undefined,
            allVisitedNodes,
            messagesSent,
            steps,
            Date.now() - startTime,
            session.status
          );
        }
        pathIndex = expectedIndex;

        // Check if we reached the end of the path
        const isAtEnd = pathIndex === variation.path.length - 1;
        if (isAtEnd) {
          steps.push({
            nodeId: currentNodeId,
            action: "finish",
            details: "Reached end of path",
            timestamp: Date.now(),
          });
          break;
        }

        // Determine what input to provide
        const nodeInputs = inputsByNode.get(currentNodeId);
        const nextExpectedNode = variation.path[pathIndex + 1];

        if (nodeInputs && nodeInputs.length > 0) {
          // Use the first matching input for this node
          const input = nodeInputs.shift()!;
          await this.applyInput(adapter, engine, input, steps, session, variation.timing, shouldSkipWaits);

          // Always wait for transition after input (event queue is async even in "none" mode)
          // This ensures session.currentNodeId is updated before we check for divergence
          // Account for node delays: if current node has a delay, we need to wait for it
          // Pass raw delay - waitForTransition handles scaling internally
          if (!shouldSkipWaits && session.currentNodeId === currentNodeId && session.status === "active") {
            const nodeDelay = this.getNodeDelayMs(currentNodeId);
            await this.waitForTransition(session, currentNodeId, nodeDelay + 100);
          }

          // Check for divergence after input has been processed
          // We need to check if engine took the EXPECTED path, not just any path
          // The engine may auto-transition through intermediate nodes to a final node
          // that's in the path, but via wrong intermediate nodes
          const allVisitedSoFar = this.mergeVisitedNodes(visitedNodes, session);

          // Find any visited node that's NOT in the expected path
          for (const visitedNode of allVisitedSoFar) {
            if (variation.path.indexOf(visitedNode) === -1) {
              // Engine visited a node not in the expected path
              // Check if this is a valid alternate path before marking as failure
              const expectedNode = variation.path[pathIndex + 1] || variation.path[pathIndex] || "unknown";
              const alternateCheck = this.alternatePathDetector.checkDivergence(
                currentNodeId,
                expectedNode,
                visitedNode,
                input
              );

              if (alternateCheck.isValid) {
                // This is a valid alternate path - return success with alternate path info
                this.logger.debug(
                  {
                    nodeId: visitedNode,
                    reason: alternateCheck.info?.reason,
                    expectedNode,
                  },
                  "runner:validAlternatePath"
                );
                return this.createResult(
                  variation,
                  true,
                  undefined,
                  undefined,
                  allVisitedSoFar,
                  messagesSent,
                  steps,
                  Date.now() - startTime,
                  session.status,
                  alternateCheck.info
                );
              }

              // Not a valid alternate - this is a real failure
              return this.createResult(
                variation,
                false,
                `Path diverged: visited node "${visitedNode}" after input "${input.inputType}" at "${currentNodeId}", which is not in expected path [${variation.path.join(" → ")}]`,
                undefined,
                allVisitedSoFar,
                messagesSent,
                steps,
                Date.now() - startTime,
                session.status
              );
            }
          }
        } else {
          // No specific input - try to advance based on path
          // Use cached edge lookup for O(1) access
          const sourceEdges = this.edgesBySource.get(currentNodeId) || [];
          const edge = sourceEdges.find((e) => e.target === nextExpectedNode);

          if (edge) {
            // Force transition via edge
            steps.push({
              nodeId: currentNodeId,
              action: "force",
              details: `Forcing edge ${edge.id}`,
              timestamp: Date.now(),
            });
            // Use 30s timeout to accommodate handlers with delays
            await this.withTimeout(engine.forceEdgeTransition(edge.id), 30000);
          } else {
            // No edge found - check if already transitioned
            // Only wait if NOT in synchronous mode (race condition testing needs waits)
            // Pass raw delay - waitForTransition handles scaling internally
            if (!shouldSkipWaits && session.currentNodeId === currentNodeId && session.status === "active") {
              const nodeDelay = this.getNodeDelayMs(currentNodeId);
              await this.waitForTransition(session, currentNodeId, nodeDelay + 50);
            }
          }
        }

        // Check if already transitioned (avoid unnecessary waits)
        // Skip in synchronous mode - MockAdapter completes immediately
        // Pass raw delay - waitForTransition handles scaling internally
        if (!shouldSkipWaits && session.currentNodeId === currentNodeId && session.status === "active") {
          const nodeDelay = this.getNodeDelayMs(currentNodeId);
          await this.waitForTransition(session, currentNodeId, nodeDelay + 100);
        }
      }

      // Check final state
      if (safetyCounter >= MAX_STEPS) {
        // Merge manually tracked nodes with session.history for complete coverage
        const allVisitedNodes = this.mergeVisitedNodes(visitedNodes, session);
        return this.createResult(
          variation,
          false,
          `Exceeded maximum steps (${MAX_STEPS})`,
          undefined,
          allVisitedNodes,
          messagesSent,
          steps,
          Date.now() - startTime,
          session.status
        );
      }

      // Merge manually tracked nodes with session.history for complete coverage
      const allVisitedNodes = this.mergeVisitedNodes(visitedNodes, session);

      // Success
      return this.createResult(
        variation,
        true,
        undefined,
        undefined,
        allVisitedNodes,
        messagesSent,
        steps,
        Date.now() - startTime,
        session.status
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      // Merge manually tracked nodes with session.history for complete coverage
      // Handle case where session wasn't created (setup error)
      const allVisitedNodes = session
        ? this.mergeVisitedNodes(visitedNodes, session)
        : visitedNodes;

      return this.createResult(
        variation,
        false,
        errorMessage,
        stack,
        allVisitedNodes,
        messagesSent,
        steps,
        Date.now() - startTime,
        session?.status ?? "failed"
      );
    } finally {
      if (engine) {
        try {
          await engine.destroy();
        } catch (error) {
          this.logger.warn(
            { err: error instanceof Error ? error.message : String(error), variationId: variation.id },
            "runner:cleanupFailed"
          );
        }
      }
    }
  }

  /**
   * Apply an input to the engine
   */
  private async applyInput(
    adapter: MockMessagingAdapter,
    engine: SessionEngine,
    input: NodeInput,
    steps: VariationStep[],
    session: EnhancedUserJourney,
    timing: TimingScenario,
    shouldSkipWaits: boolean
  ): Promise<void> {
    switch (input.inputType) {
      case "button":
        steps.push({
          nodeId: input.nodeId,
          action: "click",
          details: `Button ${input.value}`,
          timestamp: Date.now(),
        });
        // Use longer timeout to handle nodes with delays
        await this.withTimeout(
          adapter.simulateButtonClick(input.value!, session.userId, session.sessionId),
          30000
        );
        break;

      case "text":
        steps.push({
          nodeId: input.nodeId,
          action: "text",
          details: `Text: "${input.value?.slice(0, 20)}..."`,
          timestamp: Date.now(),
        });
        // Use longer timeout to handle nodes with delays
        await this.withTimeout(
          adapter.simulateMessage(input.value || "", session.userId, session.sessionId),
          30000
        );
        break;

      case "timeout": {
        // Find the timer for this specific node (not just any timer for the session)
        const timers = adapter.getScheduledTimers();
        const nodeEdges = this.edgesBySource.get(input.nodeId) || [];
        const nodeEdgeIds = new Set(nodeEdges.map((e) => e.id));

        // For wait nodes and nodes with timer edges, find the timer by edge ID
        // Note: Plugin timeouts are handled by plugin_timeout input type (applyPluginTimeout)
        const timer = timers.find(
          (t) => t.sessionId === session.sessionId && nodeEdgeIds.has(t.edgeId)
        );

        if (timer) {
          steps.push({
            nodeId: input.nodeId,
            action: "timeout",
            details: `Timer ${timer.timerId}`,
            timestamp: Date.now(),
          });

          // Handle timing scenario
          if (timing === "user_first") {
            // User action first (simulated by skipping timeout)
            await this.withTimeout(
              adapter.simulateMessage("test", session.userId, session.sessionId),
              30000
            );
          } else {
            await this.withTimeout(
              adapter.simulateTimeout(timer.timerId, session.userId, session.sessionId),
              30000
            );
          }
        } else {
          // No timer found, try to force transition
          // Use cached lookups for O(1) access
          const node = this.nodeMap.get(input.nodeId);
          const sourceEdges = this.edgesBySource.get(input.nodeId) || [];

          // For wait nodes, force the first edge (wait nodes use default edges, not timer edges)
          // For other nodes with timer edges, force the timer edge
          const isWaitNode = node?.data.type === "wait";
          const edgeToForce = isWaitNode ? sourceEdges[0] : sourceEdges.find(isTimerEdge);

          if (edgeToForce) {
            steps.push({
              nodeId: input.nodeId,
              action: "force",
              details: isWaitNode
                ? `Forcing wait edge ${edgeToForce.id} (no scheduled timer)`
                : `Forcing timer edge ${edgeToForce.id} (no scheduled timer)`,
              timestamp: Date.now(),
            });
            // Use 30s timeout to accommodate handlers with delays
            await this.withTimeout(engine.forceEdgeTransition(edgeToForce.id), 30000);
          }
        }
        break;
      }

      case "auto":
        steps.push({
          nodeId: input.nodeId,
          action: "auto",
          details: "Auto-transition",
          timestamp: Date.now(),
        });
        // For auto inputs, wait longer since the node may have delays
        // (e.g., message nodes with delay property can take several seconds)
        // Use 10 seconds as max wait - enough for typical delays but not excessive
        if (!shouldSkipWaits && session.currentNodeId === input.nodeId && session.status === "active") {
          await this.waitForTransition(session, input.nodeId, 10000);
        }
        break;

      case "plugin_timeout":
        // Trigger all plugin timers until sequence exhausts (reaches exit path)
        await this.applyPluginTimeout(adapter, engine, input, steps, session);
        break;

      case "plugin_button":
        // Advance through plugin steps and click button at target step
        await this.applyPluginButton(adapter, engine, input, steps, session);
        break;
    }
  }

  /**
   * Configure timing simulation for race condition testing
   */
  private configureTimingSimulation(
    adapter: MockMessagingAdapter,
    timing: TimingScenario
  ): void {
    switch (timing) {
      case "concurrent":
        // Add small delay to create race window
        adapter.setHandlerDelay(5);
        break;
      case "timeout_first":
        // Delay user actions to let timeout fire first
        adapter.setHandlerDelay(10);
        break;
      case "user_first":
      case "none":
      default:
        // No delay
        break;
    }
  }

  /**
   * Wait for the engine to transition away from a node
   * Optimized: Uses exponential backoff starting at 1ms
   */
  private async waitForTransition(
    session: EnhancedUserJourney,
    fromNodeId: string,
    timeoutMs: number
  ): Promise<void> {
    const startTime = Date.now();
    // In instant mode, use minimal floor (1ms) to allow event loop to process
    // Normal mode uses 50ms minimum to ensure async operations complete
    const minWaitMs = this.options.timeScale < 0.01 ? 1 : 50;
    const scaledTimeoutMs = Math.max(minWaitMs, this.scaleWaitMs(timeoutMs));
    let delay = 1; // Start with 1ms delay
    while (
      session.currentNodeId === fromNodeId &&
      session.status === "active" &&
      Date.now() - startTime < scaledTimeoutMs
    ) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      // Exponential backoff: 1, 2, 4, 8, 16ms max
      delay = Math.min(delay * 2, 16);
    }
  }

  /**
   * Get the delay configured on a node (in milliseconds).
   * Returns 0 if the node has no delay or doesn't exist.
   */
  private getNodeDelayMs(nodeId: string): number {
    const node = this.nodeMap.get(nodeId);
    if (!node) return 0;

    if (node.data.type === "message") {
      const msgData = node.data as MessageNodeData;
      // delay is in seconds, convert to ms
      return (msgData.delay ?? 0) * 1000;
    }
    return 0;
  }

  /**
   * Check whether a path contains async behavior that requires waiting.
   */
  private pathHasAsyncBehavior(path: string[]): boolean {
    for (const nodeId of path) {
      const node = this.nodeMap.get(nodeId);
      if (!node) continue;

      switch (node.data.type) {
        case "message": {
          const msgData = node.data as MessageNodeData;
          if (typeof msgData.delay === "number" && msgData.delay > 0) return true;
          if (msgData.timer && msgData.timer.seconds > 0) return true;
          break;
        }
        case "questionnaire": {
          const qData = node.data as QuestionnaireNodeData;
          if (qData.timeout?.seconds && qData.timeout.seconds > 0) return true;
          break;
        }
        case "wait":
          return true;
        case "agent": {
          const agentData = node.data as { timeout?: { seconds?: number } };
          if (agentData.timeout?.seconds && agentData.timeout.seconds > 0) return true;
          break;
        }
      }
    }

    return false;
  }

  /**
   * Create a fresh session for a variation
   */
  private createSession(variation: TestVariation): EnhancedUserJourney {
    return {
      sessionId: `test-${variation.id}`,
      journeyId: (this.journey as { id?: string }).id || "test-journey",
      userId: "test-user",
      platformUserId: "test-user",
      currentNodeId: variation.path[0],
      status: "active",
      context: {},
      tags: [],
      history: [],
      pendingTimers: [],
      pendingPluginFollowUps: [],
      nodeOutputs: {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    hasStarted: false,
    };
  }

  /**
   * Create a variation result
   */
  private createResult(
    variation: TestVariation,
    success: boolean,
    error: string | undefined,
    stack: string | undefined,
    visitedNodes: string[],
    messagesSent: string[],
    steps: VariationStep[],
    durationMs: number,
    finalStatus: string,
    alternatePath?: AlternatePathInfo
  ): VariationResult {
    return {
      variation,
      success,
      status: alternatePath ? "alternate_path" : success ? "passed" : "failed",
      alternatePath,
      error,
      stack,
      visitedNodes,
      messagesSent,
      steps,
      durationMs,
      finalStatus,
    };
  }

  /**
   * Wrap a promise with a timeout
   * IMPORTANT: Clears the timer when promise resolves to prevent timer leak
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutMs = this.scaleTimeoutMs(ms);

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  private scaleWaitMs(ms: number): number {
    // In instant mode (timeScale < 0.01), use a floor of 25ms to allow:
    // - Event loop processing for async operations
    // - Timer scheduling to complete
    // - Multiple retry attempts in wait loops
    // The previous value of 1ms was too short, causing waitForPluginTimer
    // to exit after a single check when the 10ms sleep exceeded the 1ms timeout.
    // Normal mode uses 50ms minimum for operations with real delays.
    const minMs = this.options.timeScale < 0.01 ? 25 : 50;
    return scaleDuration(ms, this.options.timeScale, minMs);
  }

  private scaleTimeoutMs(ms: number): number {
    // DO NOT scale timeouts for CPU-bound operations.
    //
    // withTimeout() wraps engine operations (start, forceEdgeTransition, simulateTimeout, etc.)
    // that take real CPU time regardless of time scaling. Time scaling is only meant for
    // simulated delays (like wait node durations), not CPU processing.
    //
    // The 30000ms timeout provides safety headroom for engine processing, especially when
    // running hundreds of thousands of parallel variations. Scaling this to 300ms with
    // fast-clock mode causes spurious timeouts.
    //
    // scaleWaitMs() is the correct function for scaling simulated delays.
    return ms;
  }

  /**
   * Merge manually tracked visited nodes with nodes from session.history
   * This ensures coverage tracking includes nodes visited during auto-transitions
   */
  private mergeVisitedNodes(
    manuallyTracked: string[],
    session: EnhancedUserJourney
  ): string[] {
    // Extract nodeIds from session history (includes auto-transitions)
    const historyNodes = (session.history || [])
      .filter((event) => event.nodeId)
      .map((event) => event.nodeId);

    // Merge and deduplicate while preserving order
    const seen = new Set<string>();
    const result: string[] = [];

    // Add history nodes first (they're in chronological order)
    for (const nodeId of historyNodes) {
      if (!seen.has(nodeId)) {
        seen.add(nodeId);
        result.push(nodeId);
      }
    }

    // Add any manually tracked nodes that weren't in history
    for (const nodeId of manuallyTracked) {
      if (!seen.has(nodeId)) {
        seen.add(nodeId);
        result.push(nodeId);
      }
    }

    return result;
  }

  /**
   * Apply a plugin timeout input - triggers all plugin timers until sequence exhausts
   */
  private async applyPluginTimeout(
    adapter: MockMessagingAdapter,
    _engine: SessionEngine,
    input: NodeInput,
    steps: VariationStep[],
    session: EnhancedUserJourney
  ): Promise<void> {
    const pluginId = input.pluginId!;
    let stepIndex = 0;
    const MAX_STEPS = 10; // Safety limit

    // Trigger all plugin timers until sequence exhausts
    while (stepIndex < MAX_STEPS) {
      // Wait for plugin timer to be scheduled
      await this.waitForPluginTimer(adapter, session, pluginId);

      const timers = adapter.getScheduledTimers();
      const pluginTimer = timers.find(
        (t) =>
          t.sessionId === session.sessionId &&
          t.edgeId?.startsWith(`followup-plugin:${pluginId}:`)
      );

      if (!pluginTimer) break;

      steps.push({
        nodeId: input.nodeId,
        action: "timeout",
        details: `Plugin ${pluginId} step ${stepIndex}`,
        timestamp: Date.now(),
      });

      await this.withTimeout(
        adapter.simulateTimeout(pluginTimer.timerId, session.userId, session.sessionId),
        30000
      );
      stepIndex++;
    }
  }

  /**
   * Apply a plugin button input - advance through steps and click button at target step
   */
  private async applyPluginButton(
    adapter: MockMessagingAdapter,
    _engine: SessionEngine,
    input: NodeInput,
    steps: VariationStep[],
    session: EnhancedUserJourney
  ): Promise<void> {
    const pluginId = input.pluginId!;
    const targetStepIndex = input.stepIndex!;
    const buttonId = input.value!;

    // Advance through plugin steps until we reach the target step
    for (let i = 0; i <= targetStepIndex; i++) {
      // Wait for plugin timer to be scheduled
      await this.waitForPluginTimer(adapter, session, pluginId);

      const timers = adapter.getScheduledTimers();
      const pluginTimer = timers.find(
        (t) =>
          t.sessionId === session.sessionId &&
          t.edgeId === `followup-plugin:${pluginId}:${i}`
      );

      if (!pluginTimer) break;

      // Trigger timeout to send follow-up message (which makes buttons available)
      await this.withTimeout(
        adapter.simulateTimeout(pluginTimer.timerId, session.userId, session.sessionId),
        30000
      );

      // On target step, click the button
      if (i === targetStepIndex) {
        steps.push({
          nodeId: input.nodeId,
          action: "click",
          details: `Plugin button ${buttonId} step ${targetStepIndex}`,
          timestamp: Date.now(),
        });

        await this.withTimeout(
          adapter.simulateButtonClick(buttonId, session.userId, session.sessionId),
          30000
        );
      }
    }
  }

  /**
   * Wait for a plugin timer to be scheduled
   * Uses exponential backoff (1, 2, 4, 8ms max) for better performance
   */
  private async waitForPluginTimer(
    adapter: MockMessagingAdapter,
    session: EnhancedUserJourney,
    pluginId: string,
    timeoutMs = 1000
  ): Promise<void> {
    const startTime = Date.now();
    const scaledTimeout = this.scaleWaitMs(timeoutMs);
    let delay = 1; // Start with 1ms delay

    while (Date.now() - startTime < scaledTimeout) {
      const timers = adapter.getScheduledTimers();
      const hasTimer = timers.some(
        (t) =>
          t.sessionId === session.sessionId &&
          t.edgeId?.startsWith(`followup-plugin:${pluginId}:`)
      );
      if (hasTimer) return;
      await new Promise((r) => setTimeout(r, delay));
      // Exponential backoff: 1, 2, 4, 8ms max
      delay = Math.min(delay * 2, 8);
    }
  }
}
