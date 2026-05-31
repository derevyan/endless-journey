/**
 * MindState Analyzer
 *
 * Handles mindstate analysis policy logic for user messages during journey execution.
 *
 * Analysis modes:
 * - automatic: Analyze every user message
 * - selective: Analyze based on node type rules
 * - node-triggered: Only explicit triggers
 * - manual: API-only, no automatic analysis
 *
 * Start conditions:
 * - immediate: Start from first message
 * - after_messages: Wait for N messages before starting
 * - after_node: Start after reaching specific node (inclusive)
 */

import { createLogger, serializeError } from "@journey/logger";
import { EventTypes, type AnalysisStartCondition, type InteractionEvent, type JourneyMindstateConfig, type JourneyNodeData, type NodeTypeRules, type StateChange } from "@journey/schemas";
import type { EventLogger, MindstateService } from "../types";

// =============================================================================
// TYPES
// =============================================================================

export interface MindstateAnalyzerConfig {
  mindstateConfig: JourneyMindstateConfig | null;
  mindstateService: MindstateService | undefined;
  eventLogger: EventLogger;
  log: ReturnType<typeof createLogger>;
  sessionHistory: InteractionEvent[];
}

export interface AnalyzeParams {
  userMessage: string;
  currentNodeId: string;
  userId: string;
  sessionId: string;
  getNode: (id: string) => JourneyNodeData | undefined;
}

// =============================================================================
// MINDSTATE ANALYZER
// =============================================================================

export class MindstateAnalyzer {
  private config: MindstateAnalyzerConfig;
  private state = {
    started: false,
    messageCount: 0,
    visitedNodes: new Set<string>(),
  };

  constructor(config: MindstateAnalyzerConfig) {
    this.config = config;

    // Rehydrate visited nodes from history
    if (config.sessionHistory) {
      config.sessionHistory.forEach((event) => {
        if (event.nodeId) {
          this.state.visitedNodes.add(event.nodeId);
        }
      });
    }
  }

  /**
   * Track that a node has been visited (for after_node start condition)
   */
  trackVisitedNode(nodeId: string): void {
    this.state.visitedNodes.add(nodeId);
  }

  /**
   * Analyze user message for mindstate changes
   *
   * This method checks analysis policies before triggering analysis:
   * 1. Check if mindstate is configured
   * 2. Check analysis mode (automatic, selective, node-triggered, manual)
   * 3. Check start condition (immediate, after_messages, after_node)
   * 4. Check node type rules (for selective mode)
   */
  async analyze(params: AnalyzeParams): Promise<void> {
    const { mindstateConfig, mindstateService, eventLogger, log } = this.config;
    const { userMessage, currentNodeId, userId, sessionId, getNode } = params;

    // Skip if no mindstate config or service
    if (!mindstateConfig || !mindstateService) {
      return;
    }

    // Skip if no mindstate keys configured
    const keys = mindstateConfig.keys;
    if (!keys || keys.length === 0) {
      return;
    }

    const analysisMode = mindstateConfig.analysisMode || "automatic";

    // Increment message count for start condition tracking
    this.state.messageCount++;

    // Check analysis mode
    switch (analysisMode) {
      case "automatic":
        // Automatic mode - analyze if start condition is met
        if (!this.isAnalysisStartConditionMet(mindstateConfig.startCondition)) {
          log.debug({ mode: analysisMode, messageCount: this.state.messageCount }, "engine:mindstateAnalysis:skipped:startConditionNotMet");
          return;
        }
        break;

      case "selective":
        // Selective mode - check start condition AND node type rules
        if (!this.isAnalysisStartConditionMet(mindstateConfig.startCondition)) {
          log.debug({ mode: analysisMode, messageCount: this.state.messageCount }, "engine:mindstateAnalysis:skipped:startConditionNotMet");
          return;
        }

        // Get current node type
        const currentNode = getNode(currentNodeId);
        if (!currentNode) {
          return;
        }

        // Check node type rules
        if (!this.matchesNodeTypeRules(currentNode.data.type.toUpperCase(), mindstateConfig.nodeTypeRules)) {
          return;
        }
        break;

      case "node-triggered":
      case "manual":
        // These modes don't trigger automatic analysis
        log.debug({ mode: analysisMode }, "engine:mindstateAnalysis:skipped:modeDisabled");
        return;

      default:
        // Unknown mode - skip
        log.warn({ mode: analysisMode }, "engine:mindstateAnalysis:unknownMode");
        return;
    }

    log.debug({ clientId: userId, keys, mode: analysisMode, message: userMessage.slice(0, 100) }, "engine:mindstateAnalysis:start");

    try {
      // Analyze message against each configured mindstate
      for (const mindstateKey of keys) {
        const mindstate = await mindstateService.getOrCreateMindstate(userId, mindstateKey);
        const result = await mindstateService.analyzeMessage(mindstate.id, userMessage, sessionId);

        log.info(
          {
            clientId: userId,
            mindstateKey,
            mindstateId: mindstate.id,
            changesCount: result.changes.length,
          },
          "engine:mindstateAnalysis:complete"
        );

        // Log mindstate event for simulator console
        if (result.changes.length > 0) {
          eventLogger.logEvent({
            type: EventTypes.MINDSTATE_UPDATED,
            nodeId: currentNodeId,
            payload: {
              mindstateKey,
              changesCount: result.changes.length,
              changes: result.changes.map((c: StateChange) => ({
                parameter: c.parameterName,
                from: c.previousValue,
                to: c.newValue,
              })),
            },
          });
        }
      }
    } catch (error) {
      log.error({ err: serializeError(error), clientId: userId, keys }, "engine:mindstateAnalysis:error");
      // Don't throw - mindstate analysis is non-blocking
    }
  }

  /**
   * Check if analysis start condition is met
   */
  private isAnalysisStartConditionMet(startCondition: AnalysisStartCondition | undefined): boolean {
    const { log } = this.config;

    // No condition or immediate = always start
    if (!startCondition || startCondition.type === "immediate") {
      return true;
    }

    // If already started, keep going
    if (this.state.started) {
      return true;
    }

    switch (startCondition.type) {
      case "after_messages":
        // Start after N messages (current count >= threshold)
        if (this.state.messageCount >= startCondition.count) {
          this.state.started = true;
          log.info({ messageCount: this.state.messageCount, threshold: startCondition.count }, "engine:mindstateAnalysis:startConditionMet:afterMessages");
          return true;
        }
        return false;

      case "after_node":
        // Start after reaching a specific node (inclusive - includes the trigger node)
        if (this.state.visitedNodes.has(startCondition.nodeId)) {
          this.state.started = true;
          log.info({ nodeId: startCondition.nodeId }, "engine:mindstateAnalysis:startConditionMet:afterNode");
          return true;
        }
        return false;

      default:
        return true;
    }
  }

  /**
   * Check if current node type matches node type rules for selective mode
   */
  private matchesNodeTypeRules(nodeType: string, rules: NodeTypeRules | undefined): boolean {
    const { log } = this.config;

    // No rules = analyze all
    if (!rules) {
      return true;
    }

    // skipTypes takes precedence - if node type is in skip list, don't analyze
    if (rules.skipTypes && rules.skipTypes.includes(nodeType as (typeof rules.skipTypes)[number])) {
      log.debug({ nodeType, skipTypes: rules.skipTypes }, "engine:mindstateAnalysis:skipped:nodeTypeInSkipList");
      return false;
    }

    // If analyzeTypes is empty or not set, analyze all (except skipped)
    if (!rules.analyzeTypes || rules.analyzeTypes.length === 0) {
      return true;
    }

    // Check if node type is in analyze list
    const shouldAnalyze = rules.analyzeTypes.includes(nodeType as (typeof rules.analyzeTypes)[number]);
    if (!shouldAnalyze) {
      log.debug({ nodeType, analyzeTypes: rules.analyzeTypes }, "engine:mindstateAnalysis:skipped:nodeTypeNotInAnalyzeList");
    }
    return shouldAnalyze;
  }
}
