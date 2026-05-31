/**
 * Variation Explorer
 *
 * Discovers all possible test variations for a journey by:
 * 1. Finding all paths through the graph (using PathExplorer)
 * 2. Expanding each path with input variations (buttons, text, timeouts)
 * 3. Adding race condition variations for timer nodes
 *
 * @module engine/testing/variation-explorer
 */

import {
  PluginEdgeId,
  generatePluginId,
  type JourneyConfig,
  type JourneyNodeData,
  type MessageNodeData,
  type ConditionNodeData,
  type QuestionnaireNodeData,
  type ButtonConfig,
  type FollowUpPluginData,
  type PluginData,
} from "@journey/schemas";
import { PathExplorer } from "../validation/path-explorer";
import { buildGraph, type Graph } from "../validation/graph-utils";
import { isTimerEdge } from "../utils";
import { ContextDeriver } from "./context-deriver";
import { hasTimer, isInteractiveNode } from "./journey-node-utils";
import type {
  TestVariation,
  NodeInput,
  TimingScenario,
  VariationExplorerOptions,
  InputType,
} from "./types";

// =============================================================================
// SEEDED RANDOM (for reproducibility)
// =============================================================================

/**
 * Simple seeded random number generator (Mulberry32)
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Generate a random float between 0 and 1 */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Pick a random element from an array */
  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)];
  }

  /** Generate a random string */
  string(length: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789 ";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(this.next() * chars.length)];
    }
    return result;
  }
}

// =============================================================================
// TEXT SAMPLES (for text input variations)
// =============================================================================

const TEXT_SAMPLES = {
  short: "ok",
  medium: "Hello, this is a test message",
  long: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  specialChars: "Test with émojis 🎉 and spëcial châràctérs!",
  numbers: "12345",
  newlines: "Line 1\nLine 2\nLine 3",
};

// =============================================================================
// VARIATION EXPLORER
// =============================================================================

/** Info about a plugin attached to a parent node */
interface AttachedPluginInfo {
  /** Synthetic plugin ID (plugin-{type}-{parentNodeId}) */
  pluginId: string;
  /** Plugin data from node.data.plugins[] */
  pluginData: PluginData;
  /** Exit node ID from plugin exit edge */
  exitNodeId?: string;
}

export class VariationExplorer {
  private journey: JourneyConfig;
  private graph: Graph;
  private options: Required<VariationExplorerOptions> & { fastMode: boolean };
  private random: SeededRandom;
  private contextDeriver: ContextDeriver;
  /** Map of parent node ID -> attached plugins */
  private nodeToPlugins: Map<string, AttachedPluginInfo[]>;

  constructor(journey: JourneyConfig, options: VariationExplorerOptions = {}) {
    this.journey = journey;
    this.graph = buildGraph(journey);
    this.contextDeriver = new ContextDeriver(journey);
    this.options = {
      maxPaths: options.maxPaths ?? 1000,
      maxDepth: options.maxDepth ?? 100,
      includeDeadEnds: options.includeDeadEnds ?? true,
      textSampleCount: options.textSampleCount ?? 3,
      includeRaceTests: options.includeRaceTests ?? false,
      seed: options.seed ?? Date.now(),
      fastMode: options.fastMode ?? false,
    };
    this.random = new SeededRandom(this.options.seed);
    this.nodeToPlugins = this.buildPluginLookup();
  }

  /**
   * Explore all variations for the journey
   */
  explore(): TestVariation[] {
    // Step 1: Find all paths through the graph
    const pathExplorer = new PathExplorer(this.journey);
    const paths = pathExplorer.findPaths({
      maxPaths: this.options.maxPaths,
      maxDepth: this.options.maxDepth,
      includeDeadEnds: this.options.includeDeadEnds,
    });

    // Step 2: Expand each path into variations
    const variations: TestVariation[] = [];

    for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
      const path = paths[pathIndex];
      const pathVariations = this.expandPathToVariations(path, pathIndex);
      variations.push(...pathVariations);
    }

    return variations;
  }

  /**
   * Get exploration statistics without generating all variations
   */
  getStats(): {
    pathCount: number;
    estimatedVariations: number;
    interactiveNodes: number;
    timerNodes: number;
  } {
    const pathExplorer = new PathExplorer(this.journey);
    const paths = pathExplorer.findPaths({
      maxPaths: this.options.maxPaths,
      maxDepth: this.options.maxDepth,
      includeDeadEnds: this.options.includeDeadEnds,
    });

    let totalInteractiveNodes = 0;
    let totalTimerNodes = 0;

    for (const nodeData of this.journey.nodes) {
      const node = nodeData;
      if (isInteractiveNode(node)) {
        totalInteractiveNodes++;
      }
      if (hasTimer(node)) {
        totalTimerNodes++;
      }
    }

    // Calculate actual variation count by simulating what explore() does
    let estimatedVariations = 0;
    for (const path of paths) {
      const interactivePoints = this.findInteractivePoints(path);
      let inputCombinations: number;

      if (interactivePoints.length === 0) {
        inputCombinations = 1; // Just auto-only variation
      } else if (this.options.fastMode) {
        // Fast mode: additive (1 baseline + sum of alternatives)
        const inputOptionsPerPoint = interactivePoints.map((point) =>
          this.getInputOptionsForNode(point.node, point.nextNodeId).length
        );
        // 1 baseline + (n1-1) + (n2-1) + ... = 1 + sum(ni) - count
        inputCombinations = 1 + inputOptionsPerPoint.reduce((a, b) => a + b, 0) - interactivePoints.length;
        inputCombinations = Math.max(1, inputCombinations);
      } else {
        // Normal mode: cartesian product (capped at 100)
        const inputOptionsPerPoint = interactivePoints.map((point) =>
          this.getInputOptionsForNode(point.node, point.nextNodeId).length
        );
        inputCombinations = Math.min(100, inputOptionsPerPoint.reduce((a, b) => a * b, 1));
      }

      // Add timing multiplier if race tests enabled and path has timer nodes
      const hasTimerOnPath = path.some((nodeId) => {
        const node = this.getNode(nodeId);
        return node && hasTimer(node);
      });
      const timingMultiplier = this.options.includeRaceTests && hasTimerOnPath ? 4 : 1; // 1 base + 3 timing scenarios

      estimatedVariations += inputCombinations * timingMultiplier;
    }

    return {
      pathCount: paths.length,
      estimatedVariations,
      interactiveNodes: totalInteractiveNodes,
      timerNodes: totalTimerNodes,
    };
  }

  /**
   * Expand a single path into multiple variations based on input options
   */
  private expandPathToVariations(path: string[], pathIndex: number): TestVariation[] {
    const variations: TestVariation[] = [];

    // Derive context requirements for this path based on condition nodes
    const { contextSetup, underivableConditions } = this.contextDeriver.deriveForPath(path);

    // Find all interactive nodes on this path
    const interactivePoints = this.findInteractivePoints(path);

    if (interactivePoints.length === 0) {
      // No interactive nodes - single variation with auto inputs
      variations.push(this.createVariation(path, pathIndex, [], "none", "auto-only", 0, contextSetup, underivableConditions));
      return variations;
    }

    // Generate input combinations for interactive nodes
    const inputCombinations = this.generateInputCombinations(interactivePoints);

    // Create a variation for each input combination
    for (let i = 0; i < inputCombinations.length; i++) {
      const inputs = inputCombinations[i];
      const inputDesc = this.describeInputs(inputs);

      // Add base variation (no timing tests)
      variations.push(
        this.createVariation(path, pathIndex, inputs, "none", inputDesc, i, contextSetup, underivableConditions)
      );

      // Add timing variations if enabled and path has timer nodes
      if (this.options.includeRaceTests) {
        const timerNodes = path.filter((nodeId) => {
          const node = this.getNode(nodeId);
          return node && hasTimer(node);
        });

        if (timerNodes.length > 0) {
          variations.push(
            this.createVariation(path, pathIndex, inputs, "user_first", `${inputDesc}_user-first`, i, contextSetup, underivableConditions)
          );
          variations.push(
            this.createVariation(path, pathIndex, inputs, "timeout_first", `${inputDesc}_timeout-first`, i, contextSetup, underivableConditions)
          );
          variations.push(
            this.createVariation(path, pathIndex, inputs, "concurrent", `${inputDesc}_concurrent`, i, contextSetup, underivableConditions)
          );
        }
      }
    }

    return variations;
  }

  /**
   * Find interactive points on a path (nodes that need user input)
   */
  private findInteractivePoints(path: string[]): InteractivePoint[] {
    const points: InteractivePoint[] = [];

    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      const node = this.getNode(nodeId);
      if (!node) continue;

      if (isInteractiveNode(node)) {
        const nextNodeId = path[i + 1];
        points.push({
          nodeId,
          node,
          pathIndex: i,
          nextNodeId,
        });
      }
    }

    return points;
  }

  /**
   * Generate all input combinations for interactive points
   * Fast mode: Additive generation (each input tested independently)
   * Normal mode: Cartesian product (all combinations)
   */
  private generateInputCombinations(points: InteractivePoint[]): NodeInput[][] {
    if (points.length === 0) return [[]];

    // Get possible inputs for each point
    const inputOptionsPerPoint = points.map((point) =>
      this.getInputOptionsForNode(point.node, point.nextNodeId)
    );

    if (this.options.fastMode) {
      // Fast mode: Additive generation - test each input option independently
      // Instead of N1 × N2 × N3 variations, we get N1 + N2 + N3 variations
      return this.additiveGeneration(inputOptionsPerPoint, points);
    }

    // Normal mode: Generate cartesian product (but limit to avoid explosion)
    return this.cartesianProduct(inputOptionsPerPoint, 100);
  }

  /**
   * Additive variation generation - each unique input is tested once
   * Creates ONE baseline variation + ONE variation per unique input option
   */
  private additiveGeneration(
    inputOptionsPerPoint: NodeInput[][],
    points: InteractivePoint[]
  ): NodeInput[][] {
    const results: NodeInput[][] = [];

    // Create baseline: use first input option from each point
    const baseline: NodeInput[] = inputOptionsPerPoint.map((options) => options[0]);
    results.push(baseline);

    // For each point, create variations with each alternative input
    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const options = inputOptionsPerPoint[pointIndex];

      // Skip first option (already in baseline), test each alternative
      for (let optIndex = 1; optIndex < options.length; optIndex++) {
        // Copy baseline and swap this point's input
        const variation = [...baseline];
        variation[pointIndex] = options[optIndex];
        results.push(variation);
      }
    }

    return results;
  }

  /**
   * Get possible inputs for a node
   *
   * IMPORTANT: Only includes buttons that are compatible with the expected path.
   * A button is compatible if:
   * - It has no targetNodeId (uses default edge), OR
   * - Its targetNodeId matches the next expected node in the path, OR
   * - Its targetNodeId exists in the graph (for edge cases without nextNodeId)
   */
  private getInputOptionsForNode(node: JourneyNodeData, nextNodeId?: string): NodeInput[] {
    const inputs: NodeInput[] = [];
    const data = node.data;

    switch (data.type) {
      case "message": {
        const msgData = data as MessageNodeData;
        const responseType = msgData.responseType || (msgData.buttons?.length ? "buttons" : "auto");

        // Button inputs - filter by path compatibility
        if (responseType === "buttons" || responseType === "any") {
          const buttons = (msgData.buttons as ButtonConfig[]) || [];
          for (const button of buttons) {
            // Only include button if it's compatible with the expected path
            if (this.isButtonCompatibleWithPath(button, nextNodeId)) {
              inputs.push({
                nodeId: node.id,
                inputType: "button",
                value: button.id,
              });
            }
          }
        }

        // Text inputs (only if the expected path matches a text-compatible edge)
        if (
          (responseType === "text" || responseType === "any") &&
          this.isTextCompatibleWithPath(node.id, nextNodeId)
        ) {
          const samples = this.getTextSamples();
          for (const text of samples) {
            inputs.push({
              nodeId: node.id,
              inputType: "text",
              value: text,
            });
          }
        }

        // Timeout only when the timer edge aligns with the expected path
        if (msgData.timer && msgData.timer.seconds > 0 && this.hasTimerEdgeTo(node.id, nextNodeId)) {
          inputs.push({
            nodeId: node.id,
            inputType: "timeout",
          });
        }
        break;
      }

      case "questionnaire": {
        const qData = data as QuestionnaireNodeData;
        // Questionnaire nodes auto-transition after completion
        // Use "auto" instead of fake button ID
        inputs.push({
          nodeId: node.id,
          inputType: "auto",
        });

        // Add timeout only when the timeout target aligns with the expected path
        if (
          qData.timeout?.seconds &&
          qData.timeout.seconds > 0 &&
          (this.hasTimerEdgeTo(node.id, nextNodeId) || qData.timeout.targetNodeId === nextNodeId)
        ) {
          inputs.push({
            nodeId: node.id,
            inputType: "timeout",
          });
        }
        break;
      }

      case "wait": {
        // Wait nodes schedule a timer that needs to be triggered
        inputs.push({
          nodeId: node.id,
          inputType: "timeout",
        });
        break;
      }

      default:
        // Auto-transition nodes
        inputs.push({
          nodeId: node.id,
          inputType: "auto",
        });
    }

    // Add plugin input options for nodes with attached follow-up plugins
    const attachedPlugins = this.nodeToPlugins.get(node.id);
    if (attachedPlugins) {
      for (const pluginInfo of attachedPlugins) {
        const pluginInputs = this.getPluginInputOptions(node.id, pluginInfo, nextNodeId);
        inputs.push(...pluginInputs);
      }
    }

    // If no inputs found, add auto
    if (inputs.length === 0) {
      inputs.push({
        nodeId: node.id,
        inputType: "auto",
      });
    }

    return inputs;
  }

  /**
   * Check if a button is compatible with the expected path.
   *
   * A button is compatible if:
   * - It has no targetNodeId (will use default edge)
   * - Its targetNodeId matches the expected next node
   * - Its targetNodeId exists in the graph (fallback for variations without nextNodeId)
   */
  private isButtonCompatibleWithPath(button: ButtonConfig, nextNodeId?: string): boolean {
    // No targetNodeId means button uses default edge - always compatible
    if (!button.targetNodeId) {
      return true;
    }

    // If we know the expected next node, button must target it
    if (nextNodeId) {
      return button.targetNodeId === nextNodeId;
    }

    // Fallback: check if targetNodeId exists in the graph
    // This catches buttons targeting non-existent nodes
    return this.graph.nodes.has(button.targetNodeId);
  }

  /**
   * Check if a text response is compatible with the expected path.
   *
   * Text input routes through non-managed default edges.
   */
  private isTextCompatibleWithPath(nodeId: string, nextNodeId?: string): boolean {
    if (!nextNodeId) return false;
    const edges = this.graph.outEdges.get(nodeId) || [];
    const textEdges = edges.filter(
      (edge) => edge.edgeType === "default" && !edge.managedBy && !isTimerEdge(edge)
    );
    if (textEdges.length === 0) return false;
    return textEdges.some((edge) => edge.target === nextNodeId);
  }

  /**
   * Get text samples for testing
   */
  private getTextSamples(): string[] {
    const samples: string[] = [];
    const allSamples = Object.values(TEXT_SAMPLES);

    // Pick random samples up to the configured count
    for (let i = 0; i < Math.min(this.options.textSampleCount, allSamples.length); i++) {
      samples.push(this.random.pick(allSamples));
    }

    return samples;
  }

  /**
   * Get a node by ID
   */
  private getNode(nodeId: string): JourneyNodeData | undefined {
    return this.graph.nodes.get(nodeId);
  }

  private hasTimerEdgeTo(nodeId: string, targetNodeId?: string): boolean {
    if (!targetNodeId) return false;
    const edges = this.graph.outEdges.get(nodeId) || [];
    return edges.some((edge) => isTimerEdge(edge) && edge.target === targetNodeId);
  }

  /**
   * Create a test variation
   */
  private createVariation(
    path: string[],
    pathIndex: number,
    inputs: NodeInput[],
    timing: TimingScenario,
    description: string,
    inputIndex = 0,
    contextSetup: Record<string, unknown> = {},
    underivableConditions: string[] = []
  ): TestVariation {
    const id = `path-${pathIndex}_input-${inputIndex}_timing-${timing}`;

    return {
      id,
      path,
      inputs,
      timing,
      contextSetup,
      underivableConditions: underivableConditions.length > 0 ? underivableConditions : undefined,
      description: `Path ${pathIndex}: ${description}`,
    };
  }

  /**
   * Describe inputs for variation naming
   */
  private describeInputs(inputs: NodeInput[]): string {
    if (inputs.length === 0) return "auto";

    const parts = inputs.slice(0, 3).map((input) => {
      if (input.inputType === "button") return `btn-${input.value?.slice(0, 8)}`;
      if (input.inputType === "text") return "text";
      if (input.inputType === "timeout") return "timeout";
      if (input.inputType === "plugin_timeout") return `plug-timeout`;
      if (input.inputType === "plugin_button") return `plug-btn-${input.value?.slice(0, 6)}`;
      return "auto";
    });

    if (inputs.length > 3) {
      parts.push(`+${inputs.length - 3}more`);
    }

    return parts.join("_");
  }

  /**
   * Generate cartesian product of input options (limited)
   */
  private cartesianProduct(arrays: NodeInput[][], maxResults: number): NodeInput[][] {
    if (arrays.length === 0) return [[]];
    if (arrays.length === 1) return arrays[0].map((item) => [item]);

    const results: NodeInput[][] = [];

    const generate = (index: number, current: NodeInput[]): void => {
      if (results.length >= maxResults) return;

      if (index === arrays.length) {
        results.push([...current]);
        return;
      }

      for (const item of arrays[index]) {
        current.push(item);
        generate(index + 1, current);
        current.pop();

        if (results.length >= maxResults) return;
      }
    };

    generate(0, []);
    return results;
  }

  /**
   * Build a lookup map from parent node ID to attached plugins.
   * Reads from embedded node.data.plugins[] arrays.
   */
  private buildPluginLookup(): Map<string, AttachedPluginInfo[]> {
    const map = new Map<string, AttachedPluginInfo[]>();

    // Iterate all nodes and extract embedded plugins
    for (const node of this.journey.nodes) {
      const plugins = (node.data as { plugins?: PluginData[] }).plugins ?? [];

      for (let pluginIndex = 0; pluginIndex < plugins.length; pluginIndex++) {
        const pluginData = plugins[pluginIndex];
        // Generate synthetic plugin ID (matches format used in UI: {parentNodeId}-plugin-{index})
        const pluginId = generatePluginId(node.id, pluginIndex);

        if (!map.has(node.id)) {
          map.set(node.id, []);
        }

        // Find exit node from plugin-exit edge
        const exitEdge = this.journey.edges.find(
          (e) => e.id === PluginEdgeId.exit(pluginId)
        );

        map.get(node.id)!.push({
          pluginId,
          pluginData,
          exitNodeId: exitEdge?.target,
        });
      }
    }

    return map;
  }

  /**
   * Get input options for a plugin attached to a node
   */
  private getPluginInputOptions(
    parentNodeId: string,
    pluginInfo: AttachedPluginInfo,
    nextNodeId?: string
  ): NodeInput[] {
    const inputs: NodeInput[] = [];
    const data = pluginInfo.pluginData as FollowUpPluginData;

    // Skip disabled plugins or plugins without steps
    if (!data.enabled || !data.steps?.length) {
      return inputs;
    }

    // Add plugin timeout option (full sequence → exit path)
    // Only include if exit node matches expected path or no path constraint
    if (pluginInfo.exitNodeId && (!nextNodeId || pluginInfo.exitNodeId === nextNodeId)) {
      inputs.push({
        nodeId: parentNodeId,
        inputType: "plugin_timeout",
        pluginId: pluginInfo.pluginId,
      });
    }

    // Add plugin button options for each step
    for (let stepIdx = 0; stepIdx < data.steps.length; stepIdx++) {
      const step = data.steps[stepIdx];
      for (const btn of step.buttons || []) {
        // Only include if button target matches expected path or no path constraint
        if (btn.targetNodeId && (!nextNodeId || btn.targetNodeId === nextNodeId)) {
          inputs.push({
            nodeId: parentNodeId,
            inputType: "plugin_button",
            value: btn.id,
            pluginId: pluginInfo.pluginId,
            stepIndex: stepIdx,
          });
        }
      }
    }

    return inputs;
  }
}

// =============================================================================
// HELPER TYPES
// =============================================================================

interface InteractivePoint {
  nodeId: string;
  node: JourneyNodeData;
  pathIndex: number;
  nextNodeId?: string;
}
