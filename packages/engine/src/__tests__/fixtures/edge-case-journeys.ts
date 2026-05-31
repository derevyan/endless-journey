/**
 * Edge Case Journey Factories
 *
 * These factory functions create journeys for testing edge cases:
 * - Loop boundary conditions (maxIterations)
 * - Timer recovery from corrupt state
 * - Middleware failures
 * - Guard evaluation errors
 * - Concurrent destruction
 * - Two-timer races
 */

import type { JourneyConfig, NodeMetadata } from "@journey/schemas";

// Helper to create metadata
const createMetadata = (): NodeMetadata => ({
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  version: "1.0.0",
  status: "active",
});

/**
 * Creates a deep linear journey with specified depth (number of nodes)
 * Used to test execute loop boundary conditions (iteration 99, 100, 101)
 *
 * @param depth - Number of message nodes before end (total nodes = depth + 2)
 * @returns Journey with start → (depth message nodes) → end
 */
export function createDeepJourney(depth: number): JourneyConfig {
  const nodes: JourneyConfig["nodes"] = [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: {
        type: "start",
        schemaVersion: 1,
        label: "Start",
        content: "Starting deep journey...",
      },
      metadata: createMetadata(),
    },
  ];

  const edges: JourneyConfig["edges"] = [];

  // Add message nodes with auto-transition
  for (let i = 1; i <= depth; i++) {
    nodes.push({
      id: `node-${i}`,
      type: "custom",
      position: { x: 0, y: i * 100 },
      data: {
        type: "message",
        schemaVersion: 2,
        contentFormat: "text",
        label: `Node ${i}`,
        content: `Message ${i}`,
        responseType: "auto",
      },
      metadata: createMetadata(),
    });

    // Edge from previous node to this one
    const sourceId = i === 1 ? "start" : `node-${i - 1}`;
    edges.push({
      id: `edge-${i}`,
      source: sourceId,
      target: `node-${i}`,
      edgeType: "default",
      label: "Auto",
    });
  }

  // Add end node
  nodes.push({
    id: "end",
    type: "custom",
    position: { x: 0, y: (depth + 1) * 100 },
    data: {
      type: "end",
      schemaVersion: 1,
      label: "End",
      content: "Journey completed!",
    },
    metadata: createMetadata(),
  });

  // Edge to end
  edges.push({
    id: "edge-to-end",
    source: depth > 0 ? `node-${depth}` : "start",
    target: "end",
    edgeType: "default",
    label: "Auto",
  });

  return { nodes, edges };
}

/**
 * Creates a journey with a loop that triggers at specific iteration
 *
 * @param loopAtIteration - Which iteration to trigger the loop (loops back to start)
 * @returns Journey that loops at specified iteration
 */
export function createJourneyWithLoopAt(loopAtIteration: number): JourneyConfig {
  const journey = createDeepJourney(loopAtIteration);

  // Replace the edge from the last message node to end with a loop back to start
  journey.edges = journey.edges.filter((e) => e.id !== "edge-to-end");
  journey.edges.push({
    id: "loop-edge",
    source: `node-${loopAtIteration}`,
    target: "start",
    edgeType: "default",
    label: "Loop back",
  });

  return journey;
}

/**
 * Creates a journey with a condition that throws an error when evaluated
 * Used to test guard evaluation error handling
 *
 * @returns Journey with a condition that references non-existent property
 */
export function createJourneyWithThrowingCondition(): JourneyConfig {
  return {
    nodes: [
      {
        id: "start",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 0 },
        data: {
          type: "start",
          schemaVersion: 1,
          label: "Start",
          content: "Starting...",
        },
        metadata: createMetadata(),
      },
      {
        id: "condition",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 100 },
        data: {
          type: "condition",
          schemaVersion: 1,
          label: "Throwing Condition",
          // This expression will throw when evaluated (accessing property of undefined)
          expression: "context.nonExistent.deepProperty.value > 10",
          rulesOperator: "and",
          branches: [
            { id: "yes-branch", label: "Yes" },
            { id: "no-branch", label: "No", isDefault: true },
          ],
        },
        metadata: createMetadata(),
      },
      {
        id: "yes-path",
        type: "custom",
        schemaVersion: 1,
        position: { x: -100, y: 200 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "Yes Path",
          content: "Condition was true!",
        },
        metadata: createMetadata(),
      },
      {
        id: "no-path",
        type: "custom",
        schemaVersion: 1,
        position: { x: 100, y: 200 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "No Path (Default)",
          content: "Condition was false or errored!",
        },
        metadata: createMetadata(),
      },
      {
        id: "end",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 300 },
        data: {
          type: "end",
          schemaVersion: 1,
          label: "End",
          content: "Done!",
        },
        metadata: createMetadata(),
      },
    ],
    edges: [
      {
        id: "e1",
        source: "start",
        target: "condition",
        edgeType: "default",
        label: "Auto",
      },
      {
        id: "e2",
        source: "condition",
        target: "yes-path",
        sourceHandle: "yes-branch",
        edgeType: "success",
        label: "Yes",
      },
      {
        id: "e3",
        source: "condition",
        target: "no-path",
        sourceHandle: "no-branch",
        edgeType: "default",
        label: "No (default)",
      },
      {
        id: "e4",
        source: "yes-path",
        target: "end",
        edgeType: "default",
        label: "Auto",
      },
      {
        id: "e5",
        source: "no-path",
        target: "end",
        edgeType: "default",
        label: "Auto",
      },
    ],
  };
}

/**
 * Creates a journey with a message node that has a delay
 * Used to test destroy mid-handler execution
 *
 * @param delaySeconds - Delay before message sends
 * @returns Journey with delayed message node
 */
export function createJourneyWithDelay(delaySeconds = 1): JourneyConfig {
  return {
    nodes: [
      {
        id: "start",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 0 },
        data: {
          type: "start",
          schemaVersion: 1,
          label: "Start",
          content: "Starting...",
        },
        metadata: createMetadata(),
      },
      {
        id: "delayed-msg",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 100 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "Delayed Message",
          content: "This message has a delay before sending",
          delay: delaySeconds,
          responseType: "auto",
        },
        metadata: createMetadata(),
      },
      {
        id: "end",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 200 },
        data: {
          type: "end",
          schemaVersion: 1,
          label: "End",
          content: "Done!",
        },
        metadata: createMetadata(),
      },
    ],
    edges: [
      {
        id: "e1",
        source: "start",
        target: "delayed-msg",
        edgeType: "default",
        label: "Auto",
      },
      {
        id: "e2",
        source: "delayed-msg",
        target: "end",
        edgeType: "default",
        label: "Auto",
      },
    ],
  };
}

/**
 * Creates a journey with two timers that fire at the same time
 * Used to test timer race conditions
 *
 * @param timerSeconds - Duration for both timers (default 0.1s for fast tests)
 * @returns Journey with two parallel timer paths
 */
export function createJourneyWithTwoTimers(timerSeconds = 0.1): JourneyConfig {
  return {
    nodes: [
      {
        id: "start",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 0 },
        data: {
          type: "start",
          schemaVersion: 1,
          label: "Start",
          content: "Starting...",
        },
        metadata: createMetadata(),
      },
      {
        id: "wait-1",
        type: "custom",
        schemaVersion: 1,
        position: { x: -100, y: 100 },
        data: {
          type: "wait",
          schemaVersion: 1,
          label: "Wait 1",
          duration: { seconds: timerSeconds },
        },
        metadata: createMetadata(),
      },
      {
        id: "wait-2",
        type: "custom",
        schemaVersion: 1,
        position: { x: 100, y: 100 },
        data: {
          type: "wait",
          schemaVersion: 1,
          label: "Wait 2",
          duration: { seconds: timerSeconds },
        },
        metadata: createMetadata(),
      },
      {
        id: "after-wait-1",
        type: "custom",
        schemaVersion: 1,
        position: { x: -100, y: 200 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "After Wait 1",
          content: "Timer 1 fired!",
          responseType: "auto",
        },
        metadata: createMetadata(),
      },
      {
        id: "after-wait-2",
        type: "custom",
        schemaVersion: 1,
        position: { x: 100, y: 200 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "After Wait 2",
          content: "Timer 2 fired!",
          responseType: "auto",
        },
        metadata: createMetadata(),
      },
      {
        id: "end",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 300 },
        data: {
          type: "end",
          schemaVersion: 1,
          label: "End",
          content: "Done!",
        },
        metadata: createMetadata(),
      },
    ],
    edges: [
      // Start goes to wait-1 (in sequential execution, only one path at a time)
      {
        id: "e1",
        source: "start",
        target: "wait-1",
        edgeType: "default",
        label: "Auto",
      },
      {
        id: "e2",
        source: "wait-1",
        target: "after-wait-1",
        edgeType: "timer",
        label: "Timer 1",
      },
      // After wait-1, go to wait-2 (to create sequential timers)
      {
        id: "e3",
        source: "after-wait-1",
        target: "wait-2",
        edgeType: "default",
        label: "Auto",
      },
      {
        id: "e4",
        source: "wait-2",
        target: "after-wait-2",
        edgeType: "timer",
        label: "Timer 2",
      },
      {
        id: "e5",
        source: "after-wait-2",
        target: "end",
        edgeType: "default",
        label: "Auto",
      },
    ],
  };
}

/**
 * Creates a journey with simultaneous timer and button (race condition)
 *
 * @param timerSeconds - Timer duration
 * @returns Journey where user can click or timeout fires
 */
export function createJourneyWithTimerAndButton(timerSeconds = 5): JourneyConfig {
  return {
    nodes: [
      {
        id: "start",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 0 },
        data: {
          type: "start",
          schemaVersion: 1,
          label: "Start",
          content: "Starting race condition test...",
        },
        metadata: createMetadata(),
      },
      {
        id: "race-node",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 100 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "Race Node",
          content: "Click the button or wait for timeout!",
          responseType: "buttons",
          buttons: [{ id: "btn-click", text: "Click Me!", targetNodeId: "clicked" }],
          timer: { seconds: timerSeconds },
        },
        metadata: createMetadata(),
      },
      {
        id: "clicked",
        type: "custom",
        schemaVersion: 1,
        position: { x: -100, y: 200 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "Clicked",
          content: "You clicked the button!",
          responseType: "auto",
        },
        metadata: createMetadata(),
      },
      {
        id: "timeout",
        type: "custom",
        schemaVersion: 1,
        position: { x: 100, y: 200 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "Timeout",
          content: "Timer expired!",
          responseType: "auto",
        },
        metadata: createMetadata(),
      },
      {
        id: "end",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 300 },
        data: {
          type: "end",
          schemaVersion: 1,
          label: "End",
          content: "Done!",
        },
        metadata: createMetadata(),
      },
    ],
    edges: [
      {
        id: "e1",
        source: "start",
        target: "race-node",
        edgeType: "default",
        label: "Auto",
      },
      {
        id: "e2",
        source: "race-node",
        target: "clicked",
        edgeType: "default",
        label: "Button click",
      },
      {
        id: "e3",
        source: "race-node",
        target: "timeout",
        edgeType: "timer",
        label: "Timeout",
      },
      {
        id: "e4",
        source: "clicked",
        target: "end",
        edgeType: "default",
        label: "Auto",
      },
      {
        id: "e5",
        source: "timeout",
        target: "end",
        edgeType: "default",
        label: "Auto",
      },
    ],
  };
}

/**
 * Creates a simple journey for testing corrupt session state recovery
 *
 * @returns Simple journey for recovery tests
 */
export function createSimpleRecoveryJourney(): JourneyConfig {
  return {
    nodes: [
      {
        id: "start",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 0 },
        data: {
          type: "start",
          schemaVersion: 1,
          label: "Start",
          content: "Welcome!",
        },
        metadata: createMetadata(),
      },
      {
        id: "wait-node",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 100 },
        data: {
          type: "wait",
          schemaVersion: 1,
          label: "Wait",
          duration: { seconds: 60 },
        },
        metadata: createMetadata(),
      },
      {
        id: "after-wait",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 200 },
        data: {
          type: "message",
          schemaVersion: 2,
          contentFormat: "text",
          label: "After Wait",
          content: "Wait completed!",
          responseType: "auto",
        },
        metadata: createMetadata(),
      },
      {
        id: "end",
        type: "custom",
        schemaVersion: 1,
        position: { x: 0, y: 300 },
        data: {
          type: "end",
          schemaVersion: 1,
          label: "End",
          content: "Done!",
        },
        metadata: createMetadata(),
      },
    ],
    edges: [
      {
        id: "e1",
        source: "start",
        target: "wait-node",
        edgeType: "default",
        label: "Auto",
      },
      {
        id: "e2",
        source: "wait-node",
        target: "after-wait",
        edgeType: "timer",
        label: "After wait",
      },
      {
        id: "e3",
        source: "after-wait",
        target: "end",
        edgeType: "default",
        label: "Auto",
      },
    ],
  };
}
