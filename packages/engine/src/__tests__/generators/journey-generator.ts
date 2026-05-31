/**
 * Journey Generator for Fuzzy Testing
 *
 * Generates random journeys for property-based testing:
 * - Valid journeys (structurally correct)
 * - Invalid journeys (specific error types)
 * - Edge case journeys (boundary conditions)
 *
 * @module engine/tests/generators/journey-generator
 */

import type { JourneyConfig, JourneyNodeData, JourneyEdgeData, NodeType } from "@journey/schemas";
import {
  SeededRandom,
  getRandom,
  setGeneratorSeed,
  generateStartNode,
  generateEndNode,
  generateMessageNode,
  generateConditionNode,
  generateWaitNode,
  generateWebhookNode,
  generateEdge,
  generateRandomNode,
} from "./node-generators";

// =============================================================================
// TYPES
// =============================================================================

/** Options for journey generation */
export interface GeneratorOptions {
  /** Minimum number of nodes (excluding start/end) */
  minNodes?: number;
  /** Maximum number of nodes (excluding start/end) */
  maxNodes?: number;
  /** Node types to include (default: all) */
  nodeTypes?: NodeType[];
  /** Include timer on message nodes */
  includeTimers?: boolean;
  /** Include condition nodes */
  includeConditions?: boolean;
  /** Include webhook nodes */
  includeWebhooks?: boolean;
  /** Probability of generating invalid journey (0-1) */
  invalidProbability?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/** Types of invalid journeys */
export type InvalidationType =
  | "no_start"
  | "no_end"
  | "multiple_starts"
  | "dangling_edge"
  | "orphan_node"
  | "auto_cycle"
  | "missing_branch_edge"
  | "missing_timer_edge"
  | "duplicate_node_id"
  | "duplicate_edge_id";

/** Types of edge case journeys */
export type EdgeCaseType =
  | "minimal" // Start → End only
  | "linear_long" // 100+ node linear chain
  | "wide_branch" // Condition with 10+ branches
  | "deep_nesting" // Deeply nested conditions
  | "all_auto" // All auto-transition nodes
  | "all_interactive" // All nodes require input
  | "max_buttons" // Message with max buttons
  | "empty_content" // Nodes with empty content
  | "long_timer" // Very long timer duration
  | "many_webhooks"; // Many webhook nodes

// =============================================================================
// VALID JOURNEY GENERATORS
// =============================================================================

/** Default options */
const DEFAULT_OPTIONS: Required<GeneratorOptions> = {
  minNodes: 2,
  maxNodes: 10,
  nodeTypes: ["message", "condition", "wait", "webhook"],
  includeTimers: true,
  includeConditions: true,
  includeWebhooks: true,
  invalidProbability: 0,
  seed: 0,
};

/**
 * Generate a valid journey with random structure
 */
export function generateValidJourney(options: GeneratorOptions = {}): JourneyConfig {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rng = opts.seed ? new SeededRandom(opts.seed) : getRandom();

  const nodes: JourneyNodeData[] = [];
  const edges: JourneyEdgeData[] = [];

  // Create start node with realistic features
  const startNode = generateStartNode("start", {}, rng);
  nodes.push(startNode);

  // Create end node with realistic features
  const endNode = generateEndNode("end", {}, rng);

  // Determine number of intermediate nodes
  const nodeCount = rng.int(opts.minNodes, opts.maxNodes);

  // Generate intermediate nodes
  const intermediateNodes: JourneyNodeData[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const node = generateRandomNode(["start", "end"], rng);
    node.id = `node-${i}`;
    intermediateNodes.push(node);
    nodes.push(node);
  }

  // Add end node
  nodes.push(endNode);

  // Connect nodes in a valid graph
  if (intermediateNodes.length === 0) {
    // Direct start → end
    edges.push(generateEdge(startNode.id, endNode.id, { label: "Auto" }, rng));
  } else {
    // Connect start → first node
    edges.push(generateEdge(startNode.id, intermediateNodes[0].id, { label: "Auto" }, rng));

    // Connect intermediate nodes
    for (let i = 0; i < intermediateNodes.length; i++) {
      const node = intermediateNodes[i];
      const isLast = i === intermediateNodes.length - 1;
      const nextTarget = isLast ? endNode.id : intermediateNodes[i + 1].id;

      if (node.data.type === "condition") {
        // Connect all branches of condition node
        const conditionData = node.data;
        for (const branch of conditionData.branches || []) {
          // For simplicity, all branches go to the next node
          edges.push(
            generateEdge(
              node.id,
              nextTarget,
              { sourceHandle: branch.id, label: branch.label },
              rng
            )
          );
        }
      } else if (node.data.type === "wait") {
        // Wait nodes use timer edge
        edges.push(
          generateEdge(node.id, nextTarget, { edgeType: "timer", label: "After wait" }, rng)
        );
      } else if (node.data.type === "webhook") {
        // Webhook success edge
        edges.push(
          generateEdge(node.id, nextTarget, { edgeType: "success", label: "Success" }, rng)
        );

        // Add error/retry edge (~50% of the time for realistic error handling)
        if (rng.bool(0.5)) {
          edges.push(
            generateEdge(node.id, nextTarget, { edgeType: "retry", label: "Error/Retry" }, rng)
          );
        }
      } else if (node.data.type === "message") {
        const messageData = node.data;
        // Regular transition
        edges.push(generateEdge(node.id, nextTarget, { label: "Continue" }, rng));

        // Add timer edge if message has timer
        if (messageData.timer) {
          edges.push(
            generateEdge(
              node.id,
              nextTarget,
              { sourceHandle: "timer", edgeType: "timer", label: "Timeout" },
              rng
            )
          );
        }

        // Add dropoff edge for interactive messages (~20% of the time)
        if (messageData.responseType !== "auto" && rng.bool(0.2)) {
          edges.push(
            generateEdge(node.id, endNode.id, { edgeType: "dropoff", label: "Abandoned" }, rng)
          );
        }
      } else if (node.data.type === "crm" || node.data.type === "teleport") {
        // CRM and Teleport nodes use default edges
        edges.push(generateEdge(node.id, nextTarget, { label: "Auto" }, rng));
      } else {
        // Default connection
        edges.push(generateEdge(node.id, nextTarget, { label: "Auto" }, rng));
      }
    }
  }

  return { nodes, edges };
}

/**
 * Generate a linear journey (start → n messages → end)
 */
export function generateLinearJourney(
  nodeCount: number,
  options: { responseType?: "auto" | "buttons" | "text"; seed?: number } = {}
): JourneyConfig {
  const rng = options.seed ? new SeededRandom(options.seed) : getRandom();
  const nodes: JourneyNodeData[] = [];
  const edges: JourneyEdgeData[] = [];

  // Start
  const startNode = generateStartNode("start", {}, rng);
  nodes.push(startNode);

  // Messages
  let prevId = startNode.id;
  const effectiveResponseType = options.responseType ?? "auto";
  for (let i = 0; i < nodeCount; i++) {
    // For auto-transition journeys, don't include timers (they would require timer edges)
    const isAutoJourney = effectiveResponseType === "auto";
    const messageNode = generateMessageNode(`msg-${i}`, {
      includeButtons: effectiveResponseType === "buttons",
      responseType: effectiveResponseType,
      includeTimer: isAutoJourney ? false : undefined, // Disable timers for pure auto-transition journeys
    }, rng);
    nodes.push(messageNode);
    edges.push(generateEdge(prevId, messageNode.id, { label: "Continue" }, rng));
    prevId = messageNode.id;
  }

  // End
  const endNode = generateEndNode("end", {}, rng);
  nodes.push(endNode);
  edges.push(generateEdge(prevId, endNode.id, { label: "Complete" }, rng));

  return { nodes, edges };
}

/**
 * Generate a branching journey with condition
 */
export function generateBranchingJourney(
  branchCount: number,
  options: { seed?: number } = {}
): JourneyConfig {
  const rng = options.seed ? new SeededRandom(options.seed) : getRandom();
  const nodes: JourneyNodeData[] = [];
  const edges: JourneyEdgeData[] = [];

  // Start
  const startNode = generateStartNode("start", {}, rng);
  nodes.push(startNode);

  // Condition
  const conditionNode = generateConditionNode("condition", { branchCount }, rng);
  nodes.push(conditionNode);
  edges.push(generateEdge(startNode.id, conditionNode.id, { label: "Check" }, rng));

  // Branch nodes
  const conditionData = conditionNode.data;
  if (conditionData.type !== "condition") throw new Error("Expected condition node");
  for (let i = 0; i < (conditionData.branches?.length ?? 0); i++) {
    const branch = conditionData.branches![i];
    // Branch message nodes don't need timers for this test
    const branchNode = generateMessageNode(`branch-${i}`, { responseType: "auto", includeTimer: false }, rng);
    nodes.push(branchNode);
    edges.push(
      generateEdge(conditionNode.id, branchNode.id, {
        sourceHandle: branch.id,
        label: branch.label,
      }, rng)
    );
  }

  // End (all branches converge)
  const endNode = generateEndNode("end", {}, rng);
  nodes.push(endNode);

  // Connect all branch nodes to end
  for (let i = 0; i < (conditionData.branches?.length ?? 0); i++) {
    edges.push(generateEdge(`branch-${i}`, endNode.id, { label: "Complete" }, rng));
  }

  return { nodes, edges };
}

// =============================================================================
// INVALID JOURNEY GENERATORS
// =============================================================================

/**
 * Generate an invalid journey of specific type
 */
export function generateInvalidJourney(
  invalidationType: InvalidationType,
  seed?: number
): JourneyConfig {
  const rng = seed ? new SeededRandom(seed) : getRandom();

  switch (invalidationType) {
    case "no_start":
      return generateJourneyWithoutStart(rng);
    case "no_end":
      return generateJourneyWithoutEnd(rng);
    case "multiple_starts":
      return generateJourneyWithMultipleStarts(rng);
    case "dangling_edge":
      return generateJourneyWithDanglingEdge(rng);
    case "orphan_node":
      return generateJourneyWithOrphanNode(rng);
    case "auto_cycle":
      return generateJourneyWithAutoCycle(rng);
    case "missing_branch_edge":
      return generateJourneyWithMissingBranchEdge(rng);
    case "missing_timer_edge":
      return generateJourneyWithMissingTimerEdge(rng);
    case "duplicate_node_id":
      return generateJourneyWithDuplicateNodeId(rng);
    case "duplicate_edge_id":
      return generateJourneyWithDuplicateEdgeId(rng);
    default:
      throw new Error(`Unknown invalidation type: ${invalidationType}`);
  }
}

function generateJourneyWithoutStart(rng: SeededRandom): JourneyConfig {
  const msg = generateMessageNode("msg-1", { responseType: "auto" }, rng);
  const end = generateEndNode("end", {}, rng);
  return {
    nodes: [msg, end],
    edges: [generateEdge(msg.id, end.id, {}, rng)],
  };
}

function generateJourneyWithoutEnd(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const msg = generateMessageNode("msg-1", { responseType: "auto" }, rng);
  return {
    nodes: [start, msg],
    edges: [generateEdge(start.id, msg.id, {}, rng)],
  };
}

function generateJourneyWithMultipleStarts(rng: SeededRandom): JourneyConfig {
  const start1 = generateStartNode("start-1", {}, rng);
  const start2 = generateStartNode("start-2", {}, rng);
  const msg = generateMessageNode("msg-1", { responseType: "auto" }, rng);
  const end = generateEndNode("end", {}, rng);
  return {
    nodes: [start1, start2, msg, end],
    edges: [
      generateEdge(start1.id, msg.id, {}, rng),
      generateEdge(start2.id, msg.id, {}, rng),
      generateEdge(msg.id, end.id, {}, rng),
    ],
  };
}

function generateJourneyWithDanglingEdge(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const msg = generateMessageNode("msg-1", { responseType: "auto" }, rng);
  const end = generateEndNode("end", {}, rng);
  return {
    nodes: [start, msg, end],
    edges: [
      generateEdge(start.id, msg.id, {}, rng),
      generateEdge(msg.id, end.id, {}, rng),
      generateEdge("nonexistent", end.id, {}, rng), // Dangling source
    ],
  };
}

function generateJourneyWithOrphanNode(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const msg = generateMessageNode("msg-1", { responseType: "auto" }, rng);
  const orphan = generateMessageNode("orphan", { responseType: "auto" }, rng);
  const end = generateEndNode("end", {}, rng);
  return {
    nodes: [start, msg, orphan, end],
    edges: [
      generateEdge(start.id, msg.id, {}, rng),
      generateEdge(msg.id, end.id, {}, rng),
      // orphan has no incoming edges
    ],
  };
}

function generateJourneyWithAutoCycle(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const msg1 = generateMessageNode("msg-1", { responseType: "auto" }, rng);
  const msg2 = generateMessageNode("msg-2", { responseType: "auto" }, rng);
  const end = generateEndNode("end", {}, rng);
  return {
    nodes: [start, msg1, msg2, end],
    edges: [
      generateEdge(start.id, msg1.id, {}, rng),
      generateEdge(msg1.id, msg2.id, {}, rng),
      generateEdge(msg2.id, msg1.id, {}, rng), // Creates cycle
      // No edge to end - cycle is infinite
    ],
  };
}

function generateJourneyWithMissingBranchEdge(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const condition = generateConditionNode("condition", { branchCount: 3 }, rng);
  const msg = generateMessageNode("msg-1", { responseType: "auto" }, rng);
  const end = generateEndNode("end", {}, rng);

  const branches = condition.data.type === "condition" ? (condition.data.branches || []) : [];

  return {
    nodes: [start, condition, msg, end],
    edges: [
      generateEdge(start.id, condition.id, {}, rng),
      // Only connect first branch, missing edges for other branches
      generateEdge(condition.id, msg.id, { sourceHandle: branches[0]?.id }, rng),
      generateEdge(msg.id, end.id, {}, rng),
    ],
  };
}

function generateJourneyWithMissingTimerEdge(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const msgWithTimer = generateMessageNode("msg-timer", {
    includeTimer: true,
    timerSeconds: 30,
    responseType: "buttons",
    buttonCount: 1,
  }, rng);
  const end = generateEndNode("end", {}, rng);

  return {
    nodes: [start, msgWithTimer, end],
    edges: [
      generateEdge(start.id, msgWithTimer.id, {}, rng),
      generateEdge(msgWithTimer.id, end.id, {}, rng), // Missing timer edge
    ],
  };
}

function generateJourneyWithDuplicateNodeId(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const msg1 = generateMessageNode("duplicate-id", { responseType: "auto" }, rng);
  const msg2 = generateMessageNode("duplicate-id", { responseType: "auto" }, rng); // Same ID!
  const end = generateEndNode("end", {}, rng);
  return {
    nodes: [start, msg1, msg2, end],
    edges: [
      generateEdge(start.id, "duplicate-id", {}, rng),
      generateEdge("duplicate-id", end.id, {}, rng),
    ],
  };
}

function generateJourneyWithDuplicateEdgeId(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const msg = generateMessageNode("msg-1", { responseType: "auto" }, rng);
  const end = generateEndNode("end", {}, rng);

  const edge1 = generateEdge(start.id, msg.id, {}, rng);
  const edge2 = generateEdge(msg.id, end.id, {}, rng);
  edge2.id = edge1.id; // Duplicate ID!

  return {
    nodes: [start, msg, end],
    edges: [edge1, edge2],
  };
}

// =============================================================================
// EDGE CASE JOURNEY GENERATORS
// =============================================================================

/**
 * Generate an edge case journey
 */
export function generateEdgeCaseJourney(
  edgeCase: EdgeCaseType,
  seed?: number
): JourneyConfig {
  const rng = seed ? new SeededRandom(seed) : getRandom();

  switch (edgeCase) {
    case "minimal":
      return generateMinimalJourney(rng);
    case "linear_long":
      return generateLinearJourney(100, { responseType: "auto", seed });
    case "wide_branch":
      return generateBranchingJourney(10, { seed });
    case "deep_nesting":
      return generateDeepNestedJourney(10, rng);
    case "all_auto":
      return generateAllAutoJourney(10, rng);
    case "all_interactive":
      return generateAllInteractiveJourney(10, rng);
    case "max_buttons":
      return generateMaxButtonsJourney(rng);
    case "empty_content":
      return generateEmptyContentJourney(rng);
    case "long_timer":
      return generateLongTimerJourney(rng);
    case "many_webhooks":
      return generateManyWebhooksJourney(10, rng);
    default:
      throw new Error(`Unknown edge case type: ${edgeCase}`);
  }
}

function generateMinimalJourney(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const end = generateEndNode("end", {}, rng);
  return {
    nodes: [start, end],
    edges: [generateEdge(start.id, end.id, {}, rng)],
  };
}

function generateDeepNestedJourney(depth: number, rng: SeededRandom): JourneyConfig {
  const nodes: JourneyNodeData[] = [];
  const edges: JourneyEdgeData[] = [];

  const start = generateStartNode("start", {}, rng);
  nodes.push(start);

  let prevId = start.id;
  for (let i = 0; i < depth; i++) {
    const condition = generateConditionNode(`cond-${i}`, { branchCount: 2 }, rng);
    nodes.push(condition);
    edges.push(generateEdge(prevId, condition.id, {}, rng));

    const branches = condition.data.type === "condition" ? (condition.data.branches || []) : [];
    // One branch continues, one goes to a message then rejoins
    // Branch message nodes don't need timers
    const branchMsg = generateMessageNode(`branch-msg-${i}`, { responseType: "auto", includeTimer: false }, rng);
    nodes.push(branchMsg);
    edges.push(
      generateEdge(condition.id, branchMsg.id, { sourceHandle: branches[1]?.id }, rng)
    );

    // The "main" branch continues to next condition
    if (i < depth - 1) {
      // Connect side branch back (will be connected later)
      prevId = condition.id;
      // Use sourceHandle for first branch
      const nextCondId = `cond-${i + 1}`;
      edges.push(
        generateEdge(condition.id, nextCondId, { sourceHandle: branches[0]?.id }, rng)
      );
      edges.push(generateEdge(branchMsg.id, nextCondId, {}, rng));
    } else {
      prevId = condition.id;
    }
  }

  const end = generateEndNode("end", {}, rng);
  nodes.push(end);

  // Connect last condition's branches to end
  const lastCond = nodes.find((n) => n.id === `cond-${depth - 1}`);
  if (lastCond && lastCond.data.type === "condition") {
    for (const branch of lastCond.data.branches || []) {
      if (!edges.some((e) => e.source === lastCond.id && e.sourceHandle === branch.id)) {
        edges.push(generateEdge(lastCond.id, end.id, { sourceHandle: branch.id }, rng));
      }
    }
  }
  edges.push(generateEdge(`branch-msg-${depth - 1}`, end.id, {}, rng));

  return { nodes, edges };
}

function generateAllAutoJourney(nodeCount: number, rng: SeededRandom): JourneyConfig {
  const nodes: JourneyNodeData[] = [];
  const edges: JourneyEdgeData[] = [];

  const start = generateStartNode("start", {}, rng);
  nodes.push(start);

  let prevId = start.id;
  for (let i = 0; i < nodeCount; i++) {
    // Auto journeys should not have timers
    const msg = generateMessageNode(`msg-${i}`, { responseType: "auto", includeTimer: false }, rng);
    nodes.push(msg);
    edges.push(generateEdge(prevId, msg.id, {}, rng));
    prevId = msg.id;
  }

  const end = generateEndNode("end", {}, rng);
  nodes.push(end);
  edges.push(generateEdge(prevId, end.id, {}, rng));

  return { nodes, edges };
}

function generateAllInteractiveJourney(nodeCount: number, rng: SeededRandom): JourneyConfig {
  const nodes: JourneyNodeData[] = [];
  const edges: JourneyEdgeData[] = [];

  const start = generateStartNode("start", {}, rng);
  nodes.push(start);

  let prevId = start.id;
  for (let i = 0; i < nodeCount; i++) {
    // Interactive journeys don't need timers for this test
    const msg = generateMessageNode(`msg-${i}`, {
      responseType: "buttons",
      buttonCount: 2,
      includeTimer: false,
    }, rng);
    nodes.push(msg);
    edges.push(generateEdge(prevId, msg.id, {}, rng));
    prevId = msg.id;
  }

  const end = generateEndNode("end", {}, rng);
  nodes.push(end);
  edges.push(generateEdge(prevId, end.id, {}, rng));

  return { nodes, edges };
}

function generateMaxButtonsJourney(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const msg = generateMessageNode("msg-buttons", {
    responseType: "buttons",
    buttonCount: 10, // Max buttons
  }, rng);
  const end = generateEndNode("end", {}, rng);

  return {
    nodes: [start, msg, end],
    edges: [
      generateEdge(start.id, msg.id, {}, rng),
      generateEdge(msg.id, end.id, {}, rng),
    ],
  };
}

function generateEmptyContentJourney(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  if (start.data.type === "start") {
    start.data.content = "";
  }

  const msg = generateMessageNode("msg-empty", { responseType: "auto" }, rng);
  if (msg.data.type === "message") {
    msg.data.content = "";
  }

  const end = generateEndNode("end", {}, rng);
  if (end.data.type === "end") {
    end.data.content = "";
  }

  return {
    nodes: [start, msg, end],
    edges: [
      generateEdge(start.id, msg.id, {}, rng),
      generateEdge(msg.id, end.id, {}, rng),
    ],
  };
}

function generateLongTimerJourney(rng: SeededRandom): JourneyConfig {
  const start = generateStartNode("start", {}, rng);
  const wait = generateWaitNode("wait-long", 86400, rng); // 24 hours
  const end = generateEndNode("end", {}, rng);

  return {
    nodes: [start, wait, end],
    edges: [
      generateEdge(start.id, wait.id, {}, rng),
      generateEdge(wait.id, end.id, { edgeType: "timer" }, rng),
    ],
  };
}

function generateManyWebhooksJourney(count: number, rng: SeededRandom): JourneyConfig {
  const nodes: JourneyNodeData[] = [];
  const edges: JourneyEdgeData[] = [];

  const start = generateStartNode("start", {}, rng);
  nodes.push(start);

  let prevId = start.id;
  for (let i = 0; i < count; i++) {
    const webhook = generateWebhookNode(`webhook-${i}`, { useMock: true }, rng);
    nodes.push(webhook);
    edges.push(generateEdge(prevId, webhook.id, {}, rng));
    prevId = webhook.id;
  }

  const end = generateEndNode("end", {}, rng);
  nodes.push(end);
  edges.push(generateEdge(prevId, end.id, { edgeType: "success" }, rng));

  return { nodes, edges };
}

// =============================================================================
// BATCH GENERATORS
// =============================================================================

/**
 * Generate multiple random journeys
 */
export function generateRandomJourneys(
  count: number,
  options: GeneratorOptions = {}
): JourneyConfig[] {
  const baseSeed = options.seed ?? Date.now();
  const journeys: JourneyConfig[] = [];

  for (let i = 0; i < count; i++) {
    const journey = generateValidJourney({ ...options, seed: baseSeed + i });
    journeys.push(journey);
  }

  return journeys;
}

/**
 * Generate a mix of valid and invalid journeys for testing
 */
export function generateMixedJourneys(
  count: number,
  invalidRatio = 0.2,
  seed?: number
): { journey: JourneyConfig; isValid: boolean; invalidationType?: InvalidationType }[] {
  const baseSeed = seed ?? Date.now();
  const rng = new SeededRandom(baseSeed);
  const results: { journey: JourneyConfig; isValid: boolean; invalidationType?: InvalidationType }[] = [];

  const invalidTypes: InvalidationType[] = [
    "no_start",
    "no_end",
    "multiple_starts",
    "dangling_edge",
    "orphan_node",
    "auto_cycle",
    "missing_branch_edge",
    "missing_timer_edge",
    "duplicate_node_id",
    "duplicate_edge_id",
  ];

  for (let i = 0; i < count; i++) {
    if (rng.bool(invalidRatio)) {
      const invalidationType = rng.pick(invalidTypes);
      results.push({
        journey: generateInvalidJourney(invalidationType, baseSeed + i),
        isValid: false,
        invalidationType,
      });
    } else {
      results.push({
        journey: generateValidJourney({ seed: baseSeed + i }),
        isValid: true,
      });
    }
  }

  return results;
}

// Re-export utilities
export { setGeneratorSeed, getRandom, SeededRandom };
