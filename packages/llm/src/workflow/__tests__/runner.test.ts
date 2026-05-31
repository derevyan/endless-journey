/**
 * Workflow Runner Unit Tests
 *
 * Tests for the workflow graph runner functionality.
 *
 * @module workflow/__tests__/runner.test
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AgentWorkflow, WorkflowNode, WorkflowEdge } from "@journey/schemas";
import type { WorkflowContext, NodeOutput, NodeExecutor } from "../types";
import { runWorkflow } from "../runner";
import { executorRegistry } from "../executor-registry";

// =============================================================================
// TEST UTILITIES
// =============================================================================

function createMockLogger(): WorkflowContext["log"] {
  return {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

function createMockContext(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    orgId: "org-test",
    sessionId: "session-test",
    user: { id: "user-test" },
    log: createMockLogger(),
    settings: {
      maxExecutionTimeMs: 60000,
      nodeTimeoutMs: 30000,
    },
    ...overrides,
  };
}

function createMockExecutor(output: Partial<NodeOutput> = {}): NodeExecutor {
  return {
    execute: vi.fn().mockResolvedValue({
      executionTimeMs: 10,
      ...output,
    }),
  };
}

function createSimpleWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): AgentWorkflow {
  return {
    id: "test-workflow",
    orgId: "org-test",
    key: "test-workflow",
    name: "Test Workflow",
    status: "active",
    configuration: { nodes, edges },
    settings: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("runWorkflow", () => {
  beforeEach(() => {
    // Clear and re-register basic executors for each test
    executorRegistry.clear();
  });

  it("executes simple Start → End workflow", async () => {
    // Register executors
    const startExecutor = createMockExecutor();
    const endExecutor = createMockExecutor({ response: "Done" });
    executorRegistry.register("start", startExecutor);
    executorRegistry.register("end", endExecutor);

    const workflow = createSimpleWorkflow(
      [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "end", type: "end", position: { x: 100, y: 0 }, data: {} },
      ],
      [{ id: "e1", source: "start", target: "end" }]
    );

    const context = createMockContext();
    const result = await runWorkflow(workflow, { message: "Hello" }, context);

    expect(result.success).toBe(true);
    expect(result.trace).toHaveLength(2);
    expect(result.trace[0].nodeId).toBe("start");
    expect(result.trace[1].nodeId).toBe("end");
  });

  it("executes Start → Agent → End workflow and captures response", async () => {
    const startExecutor = createMockExecutor();
    const agentExecutor = createMockExecutor({ response: "Hello, I'm an agent!" });
    const endExecutor = createMockExecutor();

    executorRegistry.register("start", startExecutor);
    executorRegistry.register("agent", agentExecutor);
    executorRegistry.register("end", endExecutor);

    const workflow = createSimpleWorkflow(
      [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "agent1", type: "agent", position: { x: 100, y: 0 }, data: { name: "Test Agent" } },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: {} },
      ],
      [
        { id: "e1", source: "start", target: "agent1" },
        { id: "e2", source: "agent1", target: "end" },
      ]
    );

    const context = createMockContext();
    const result = await runWorkflow(workflow, { message: "Hi" }, context);

    expect(result.success).toBe(true);
    expect(result.response).toBe("Hello, I'm an agent!");
    expect(result.trace).toHaveLength(3);
  });

  it("handles if/else branching based on outHandle", async () => {
    const startExecutor = createMockExecutor();
    const ifElseExecutor = createMockExecutor({ outHandle: "yes" });
    const yesAgentExecutor = createMockExecutor({ response: "Yes branch" });
    const noAgentExecutor = createMockExecutor({ response: "No branch" });
    const endExecutor = createMockExecutor();

    executorRegistry.register("start", startExecutor);
    executorRegistry.register("if_else", ifElseExecutor);
    executorRegistry.register("agent", yesAgentExecutor);
    executorRegistry.register("end", endExecutor);

    const workflow = createSimpleWorkflow(
      [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "if1", type: "if_else", position: { x: 100, y: 0 }, data: {} },
        { id: "yes-agent", type: "agent", position: { x: 200, y: -50 }, data: {} },
        { id: "no-agent", type: "agent", position: { x: 200, y: 50 }, data: {} },
        { id: "end", type: "end", position: { x: 300, y: 0 }, data: {} },
      ],
      [
        { id: "e1", source: "start", target: "if1" },
        { id: "e2", source: "if1", target: "yes-agent", sourceHandle: "yes" },
        { id: "e3", source: "if1", target: "no-agent", sourceHandle: "no" },
        { id: "e4", source: "yes-agent", target: "end" },
        { id: "e5", source: "no-agent", target: "end" },
      ]
    );

    const context = createMockContext();
    const result = await runWorkflow(workflow, { message: "Test" }, context);

    expect(result.success).toBe(true);
    expect(result.response).toBe("Yes branch");
    // Should have taken yes branch: start → if1 → yes-agent → end
    expect(result.trace.map((t) => t.nodeId)).toEqual(["start", "if1", "yes-agent", "end"]);
  });

  it("handles guard node blocking", async () => {
    const startExecutor = createMockExecutor();
    const guardExecutor = createMockExecutor({
      blocked: true,
      blockedMessage: "Content blocked",
    });
    const endExecutor = createMockExecutor();

    executorRegistry.register("start", startExecutor);
    executorRegistry.register("guard", guardExecutor);
    executorRegistry.register("end", endExecutor);

    const workflow = createSimpleWorkflow(
      [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "guard1", type: "guard", position: { x: 100, y: 0 }, data: {} },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: {} },
      ],
      [
        { id: "e1", source: "start", target: "guard1" },
        { id: "e2", source: "guard1", target: "end", sourceHandle: "passed" },
      ]
    );

    const context = createMockContext();
    const result = await runWorkflow(workflow, { message: "bad content" }, context);

    expect(result.success).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.blockedMessage).toBe("Content blocked");
    // Should only have start and guard in trace
    expect(result.trace).toHaveLength(2);
  });

  it("respects abort signal for cancellation", async () => {
    const startExecutor = createMockExecutor();
    const agentExecutor: NodeExecutor = {
      execute: vi.fn().mockImplementation(async () => {
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { executionTimeMs: 10, response: "Done" };
      }),
    };
    const endExecutor = createMockExecutor();

    executorRegistry.register("start", startExecutor);
    executorRegistry.register("agent", agentExecutor);
    executorRegistry.register("end", endExecutor);

    const workflow = createSimpleWorkflow(
      [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "agent1", type: "agent", position: { x: 100, y: 0 }, data: {} },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: {} },
      ],
      [
        { id: "e1", source: "start", target: "agent1" },
        { id: "e2", source: "agent1", target: "end" },
      ]
    );

    // Create an already-aborted signal
    const controller = new AbortController();
    controller.abort();

    const context = createMockContext({
      abortSignal: controller.signal,
    });

    await expect(runWorkflow(workflow, { message: "Hi" }, context)).rejects.toThrow(/abort/i);
  });

  it("throws error when executor is missing for node type", async () => {
    const startExecutor = createMockExecutor();
    const endExecutor = createMockExecutor();

    executorRegistry.register("start", startExecutor);
    executorRegistry.register("end", endExecutor);
    // Note: NOT registering "agent" executor

    const workflow = createSimpleWorkflow(
      [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "agent1", type: "agent", position: { x: 100, y: 0 }, data: {} },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: {} },
      ],
      [
        { id: "e1", source: "start", target: "agent1" },
        { id: "e2", source: "agent1", target: "end" },
      ]
    );

    const context = createMockContext();

    await expect(runWorkflow(workflow, { message: "Hi" }, context)).rejects.toThrow(
      /no executor registered/i
    );
  });

  it("tracks execution trace correctly with node types and durations", async () => {
    const startExecutor = createMockExecutor();
    const agentExecutor = createMockExecutor({ response: "Response", executionTimeMs: 150 });
    const endExecutor = createMockExecutor();

    executorRegistry.register("start", startExecutor);
    executorRegistry.register("agent", agentExecutor);
    executorRegistry.register("end", endExecutor);

    const workflow = createSimpleWorkflow(
      [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "agent1", type: "agent", position: { x: 100, y: 0 }, data: {} },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: {} },
      ],
      [
        { id: "e1", source: "start", target: "agent1" },
        { id: "e2", source: "agent1", target: "end" },
      ]
    );

    const context = createMockContext();
    const result = await runWorkflow(workflow, { message: "Test" }, context);

    expect(result.trace).toHaveLength(3);

    // Verify trace structure
    expect(result.trace[0]).toMatchObject({
      nodeId: "start",
      nodeType: "start",
      status: "completed",
    });

    expect(result.trace[1]).toMatchObject({
      nodeId: "agent1",
      nodeType: "agent",
      status: "completed",
      durationMs: 150,
    });

    expect(result.trace[2]).toMatchObject({
      nodeId: "end",
      nodeType: "end",
      status: "completed",
    });

    // Total duration should be set (may be 0 for very fast mock executions)
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("merges output data into workflow variables", async () => {
    const startExecutor = createMockExecutor({ data: { step1: "value1" } });
    const agentExecutor = createMockExecutor({
      response: "Response",
      data: { step2: "value2", result: { nested: true } },
    });
    const endExecutor = createMockExecutor();

    executorRegistry.register("start", startExecutor);
    executorRegistry.register("agent", agentExecutor);
    executorRegistry.register("end", endExecutor);

    const workflow = createSimpleWorkflow(
      [
        { id: "start", type: "start", position: { x: 0, y: 0 }, data: {} },
        { id: "agent1", type: "agent", position: { x: 100, y: 0 }, data: {} },
        { id: "end", type: "end", position: { x: 200, y: 0 }, data: {} },
      ],
      [
        { id: "e1", source: "start", target: "agent1" },
        { id: "e2", source: "agent1", target: "end" },
      ]
    );

    const context = createMockContext();
    const result = await runWorkflow(workflow, { message: "Test" }, context);

    expect(result.success).toBe(true);
    expect(result.variables).toEqual({
      step1: "value1",
      step2: "value2",
      result: { nested: true },
    });
  });
});
