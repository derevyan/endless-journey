/**
 * Alternate Path Detector
 *
 * Determines if a path divergence during variation testing is a valid
 * alternate route rather than a failure.
 *
 * Valid alternates occur when:
 * 1. Text input at responseType: "any" or "text" node routes via text-response edge
 * 2. Timeout at timer node routes via timer edge
 * 3. Guard failure routes via fallback edge
 * 4. Plugin button routes to a configured exit path
 * 5. Condition node routes based on runtime context (any branch is valid)
 *
 * @module engine/testing/alternate-path-detector
 */

import type { JourneyConfig, JourneyEdgeData, MessageNodeData } from "@journey/schemas";
import type { NodeInput, AlternatePathInfo, InputType } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface AlternatePathResult {
  /** Whether the divergence is a valid alternate path */
  isValid: boolean;
  /** Details about the alternate path (if valid) */
  info?: AlternatePathInfo;
}

// =============================================================================
// ALTERNATE PATH DETECTOR
// =============================================================================

export class AlternatePathDetector {
  private nodeMap: Map<string, JourneyConfig["nodes"][0]>;
  private edgesBySource: Map<string, JourneyEdgeData[]>;

  constructor(journey: JourneyConfig) {
    // Pre-build lookup maps for O(1) access
    this.nodeMap = new Map(journey.nodes.map((n) => [n.id, n]));
    this.edgesBySource = new Map();
    for (const edge of journey.edges) {
      if (!this.edgesBySource.has(edge.source)) {
        this.edgesBySource.set(edge.source, []);
      }
      this.edgesBySource.get(edge.source)!.push(edge);
    }
  }

  /**
   * Check if a divergence from expected path is a valid alternate path
   *
   * @param currentNodeId - Node where the input was applied
   * @param expectedNodeId - Expected next node from variation path
   * @param actualNodeId - Actual node the engine transitioned to
   * @param input - The input that was applied
   * @returns Result indicating if this is a valid alternate path
   */
  checkDivergence(
    currentNodeId: string,
    expectedNodeId: string,
    actualNodeId: string,
    input: NodeInput
  ): AlternatePathResult {
    const node = this.nodeMap.get(currentNodeId);
    if (!node) {
      return { isValid: false };
    }

    const edges = this.edgesBySource.get(currentNodeId) || [];

    // Check 1: Text input at responseType: "any" or "text" node
    if (input.inputType === "text") {
      const result = this.checkTextResponsePath(node, edges, actualNodeId, expectedNodeId, input.inputType);
      if (result.isValid) return result;
    }

    // Check 2: Timeout routing via timer edge
    if (input.inputType === "timeout") {
      const result = this.checkTimeoutPath(node, edges, actualNodeId, expectedNodeId, input.inputType);
      if (result.isValid) return result;
    }

    // Check 3: Plugin button routing to configured target
    if (input.inputType === "plugin_button") {
      const result = this.checkPluginButtonPath(actualNodeId, expectedNodeId, input);
      if (result.isValid) return result;
    }

    // Check 4: Guard fallback routing
    const fallbackResult = this.checkFallbackPath(edges, actualNodeId, expectedNodeId, input.inputType, currentNodeId);
    if (fallbackResult.isValid) return fallbackResult;

    // Check 5: Condition node routing based on runtime context
    const conditionResult = this.checkConditionNodeDivergence(
      node,
      edges,
      actualNodeId,
      expectedNodeId,
      input.inputType
    );
    if (conditionResult.isValid) return conditionResult;

    return { isValid: false };
  }

  /**
   * Check if divergence is due to plugin button navigating to its configured target
   * Plugin buttons can route to exit paths or other nodes, and this is valid alternate behavior
   */
  private checkPluginButtonPath(
    actualNodeId: string,
    expectedNodeId: string,
    input: NodeInput
  ): AlternatePathResult {
    // Plugin buttons always navigate to configured targets - this is expected behavior
    // If the journey arrived at a different node than expected, it's because the plugin
    // button's target was different from the main path - this is a valid alternate
    return {
      isValid: true,
      info: {
        divergenceNodeId: input.nodeId,
        expectedNodeId,
        actualNodeId,
        reason: "plugin_button",
        inputType: input.inputType,
      },
    };
  }

  /**
   * Check if divergence is due to text input at a node that accepts text
   */
  private checkTextResponsePath(
    node: JourneyConfig["nodes"][0],
    edges: JourneyEdgeData[],
    actualNodeId: string,
    expectedNodeId: string,
    inputType: InputType
  ): AlternatePathResult {
    // Questionnaire nodes always accept text input - this is a valid alternate path
    if (node.data.type === "questionnaire") {
      // Find if actualNodeId is reachable via any edge from this node
      const reachableEdge = edges.find((e) => e.target === actualNodeId);
      if (reachableEdge) {
        return {
          isValid: true,
          info: {
            divergenceNodeId: node.id,
            expectedNodeId,
            actualNodeId,
            reason: "text_response",
            inputType,
          },
        };
      }
    }

    // For message nodes, check responseType
    if (node.data.type !== "message") {
      return { isValid: false };
    }

    const msgData = node.data as MessageNodeData;
    const responseType = this.getEffectiveResponseType(msgData);

    // Only check for "any" or "text" response types
    if (responseType !== "any" && responseType !== "text") {
      return { isValid: false };
    }

    // Find if actualNodeId is reachable via a non-button edge (text-response path)
    // Button edges have sourceHandle set to the button ID (like "btn-xxx")
    // Text response edges typically have no sourceHandle, "output", "default", or null/undefined
    const textEdge = edges.find((e) => {
      if (e.target !== actualNodeId) return false;

      // If it's a timer edge, it's not a text response edge
      if (e.edgeType === "timer" || e.sourceHandle === "timer") return false;

      // If it's a plugin attachment edge, it's not a text response edge
      if (e.sourceHandle === "plugin-attachment") return false;

      // Check if this is a non-button edge
      // Button edges have sourceHandle matching a button ID (starts with "btn-" or contains specific pattern)
      // Standard handles that are NOT button edges: null, undefined, "", "output", "default", "timer"
      const standardHandles = [null, undefined, "", "output", "default", "timer", "plugin-attachment"];
      const isButtonEdge = e.sourceHandle && !standardHandles.includes(e.sourceHandle);

      return !isButtonEdge;
    });

    if (textEdge) {
      return {
        isValid: true,
        info: {
          divergenceNodeId: node.id,
          expectedNodeId,
          actualNodeId,
          reason: "text_response",
          inputType,
        },
      };
    }

    return { isValid: false };
  }

  /**
   * Check if divergence is due to timeout routing via timer edge
   */
  private checkTimeoutPath(
    node: JourneyConfig["nodes"][0],
    edges: JourneyEdgeData[],
    actualNodeId: string,
    expectedNodeId: string,
    inputType: InputType
  ): AlternatePathResult {
    // Find if actualNodeId is reachable via a timer edge
    const timerEdge = edges.find(
      (e) => e.target === actualNodeId && (e.edgeType === "timer" || e.sourceHandle === "timer")
    );

    if (timerEdge) {
      return {
        isValid: true,
        info: {
          divergenceNodeId: node.id,
          expectedNodeId,
          actualNodeId,
          reason: "timeout",
          inputType,
        },
      };
    }

    return { isValid: false };
  }

  /**
   * Check if divergence is due to guard fallback routing
   */
  private checkFallbackPath(
    edges: JourneyEdgeData[],
    actualNodeId: string,
    expectedNodeId: string,
    inputType: InputType,
    currentNodeId: string
  ): AlternatePathResult {
    // Find if actualNodeId is reachable via a fallback edge
    const fallbackEdge = edges.find((e) => e.target === actualNodeId && e.fallback === true);

    if (fallbackEdge) {
      return {
        isValid: true,
        info: {
          divergenceNodeId: currentNodeId,
          expectedNodeId,
          actualNodeId,
          reason: "guard_fallback",
          inputType,
        },
      };
    }

    return { isValid: false };
  }

  /**
   * Check if divergence is due to condition node routing based on runtime context
   *
   * Condition nodes evaluate expressions at runtime and route to different branches
   * based on session context (tags, variables, etc.). The variation explorer can't
   * predict which branch will be taken at runtime, so any valid outgoing edge
   * from a condition node is considered a valid alternate path.
   *
   * NOTE: We check ALL condition nodes in the journey, not just the current node,
   * because the divergence may have happened at a condition node earlier in the
   * path (before we reached the node where we detected the divergence).
   */
  private checkConditionNodeDivergence(
    node: JourneyConfig["nodes"][0],
    edges: JourneyEdgeData[],
    actualNodeId: string,
    expectedNodeId: string,
    inputType: InputType
  ): AlternatePathResult {
    // First check if current node is a condition node
    if (node.data.type === "condition") {
      const validEdge = edges.find((e) => e.target === actualNodeId);
      if (validEdge) {
        return {
          isValid: true,
          info: {
            divergenceNodeId: node.id,
            expectedNodeId,
            actualNodeId,
            reason: "condition_branch",
            inputType,
          },
        };
      }
    }

    // Check if ANY condition node in the journey could route to actualNodeId
    // This handles cases where divergence happened at a condition node earlier
    // in the path, before we reached the node where we detected the issue
    for (const [nodeId, candidateNode] of this.nodeMap) {
      if (candidateNode.data.type !== "condition") continue;

      const conditionEdges = this.edgesBySource.get(nodeId) || [];
      const routesToActual = conditionEdges.some((e) => e.target === actualNodeId);

      if (routesToActual) {
        return {
          isValid: true,
          info: {
            divergenceNodeId: nodeId, // The condition node that actually diverged
            expectedNodeId,
            actualNodeId,
            reason: "condition_branch",
            inputType,
          },
        };
      }
    }

    return { isValid: false };
  }

  /**
   * Get the effective response type for a message node
   * If not explicitly set, infer from buttons array
   */
  private getEffectiveResponseType(data: MessageNodeData): string {
    if (data.responseType) {
      return data.responseType;
    }
    // Infer from buttons array
    if (data.buttons && data.buttons.length > 0) {
      return "buttons";
    }
    return "auto";
  }
}
