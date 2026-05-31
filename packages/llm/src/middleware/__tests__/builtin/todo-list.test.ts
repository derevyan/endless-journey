/**
 * Todo List Middleware Tests
 *
 * Tests for the createTodoListMiddleware function that injects a todo list
 * tool for task planning and tracking.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createTodoListMiddleware, type TodoItem } from "../../builtin/todo-list";
import { AgentMiddlewarePipeline } from "../../middleware-pipeline";
import type { AgentState, AgentRuntime, AgentTool } from "../../types";

// ============================================================================
// Test Helpers
// ============================================================================

function createTestState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    messages: [],
    systemPrompt: "Test prompt",
    model: "gpt-4o",
    ...overrides,
  };
}

function createTestRuntime(tools: AgentTool[] = []): AgentRuntime {
  return {
    context: {
      _mwTools: tools,
    },
    nodeId: "test-node",
    sessionId: "test-session",
  };
}

// ============================================================================
// Configuration Tests
// ============================================================================

describe("createTodoListMiddleware", () => {
  describe("configuration", () => {
    it("should create middleware with default config", () => {
      const mw = createTodoListMiddleware();
      expect(mw.name).toBe("TodoListMiddleware");
      expect(mw.priority).toBe(25);
    });

    it("should create middleware with custom config", () => {
      const mw = createTodoListMiddleware({
        systemPrompt: "Always plan before acting",
        maxTodos: 100,
      });
      expect(mw.name).toBe("TodoListMiddleware");
    });
  });

  // ==========================================================================
  // Tool Injection Tests
  // ==========================================================================

  describe("tool injection", () => {
    it("should inject write_todos tool in beforeModel", async () => {
      const mw = createTodoListMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState());
      const runtime = createTestRuntime();

      await pipeline.executeBeforeModel(state, runtime);

      const tools = runtime.context._mwTools as AgentTool[];
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("write_todos");
    });

    it("should include custom toolDescription in tool", async () => {
      const mw = createTodoListMiddleware({
        toolDescription: "Custom todo tool description",
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState());
      const runtime = createTestRuntime();

      await pipeline.executeBeforeModel(state, runtime);

      const tools = runtime.context._mwTools as AgentTool[];
      expect(tools[0].description).toBe("Custom todo tool description");
    });

    it("should NOT duplicate tool if already injected", async () => {
      const mw = createTodoListMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState());
      const runtime = createTestRuntime();

      // Call beforeModel twice
      await pipeline.executeBeforeModel(state, runtime);
      await pipeline.executeBeforeModel(state, runtime);

      const tools = runtime.context._mwTools as AgentTool[];
      expect(tools).toHaveLength(1);
    });
  });

  // ==========================================================================
  // System Prompt Enhancement Tests
  // ==========================================================================

  describe("system prompt enhancement", () => {
    it("should add systemPrompt to agent's system prompt", async () => {
      const mw = createTodoListMiddleware({
        systemPrompt: "Break down complex tasks before starting.",
      });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(
        createTestState({ systemPrompt: "You are a helpful assistant." })
      );
      const runtime = createTestRuntime();

      const result = await pipeline.executeBeforeAgent(state, runtime);

      expect(result.state.systemPrompt).toContain("You are a helpful assistant.");
      expect(result.state.systemPrompt).toContain("Break down complex tasks before starting.");
    });
  });

  // ==========================================================================
  // Write Todos Tool Tests
  // ==========================================================================

  describe("write_todos tool execution", () => {
    let tool: AgentTool;

    beforeEach(async () => {
      const mw = createTodoListMiddleware({ maxTodos: 10 });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState());
      const runtime = createTestRuntime();

      await pipeline.executeBeforeModel(state, runtime);

      tool = (runtime.context._mwTools as AgentTool[])[0];
    });

    it("should add new todos", async () => {
      const result = await tool.execute({
        action: "add",
        todos: [
          { content: "First task", status: "pending" },
          { content: "Second task", status: "pending" },
        ],
      });

      expect(result).toMatchObject({
        success: true,
        totalCount: 2,
      });
      expect((result as { added: { id: string }[] }).added).toHaveLength(2);
    });

    it("should update existing todos", async () => {
      // First add a todo
      const addResult = await tool.execute({
        action: "add",
        todos: [{ content: "Original task", status: "pending" }],
      });

      const todoId = (addResult as { added: { id: string }[] }).added[0].id;

      // Update it
      const updateResult = await tool.execute({
        action: "update",
        todos: [{ id: todoId, content: "Updated task", status: "in_progress" }],
      });

      expect(updateResult).toMatchObject({
        success: true,
        updated: [todoId],
      });
    });

    it("should remove todos", async () => {
      // Add todos
      const addResult = await tool.execute({
        action: "add",
        todos: [
          { content: "Task 1", status: "pending" },
          { content: "Task 2", status: "pending" },
        ],
      });

      const ids = (addResult as { added: { id: string }[] }).added.map((t) => t.id);

      // Remove first one
      const removeResult = await tool.execute({
        action: "remove",
        ids: [ids[0]],
      });

      expect(removeResult).toMatchObject({
        success: true,
        removed: 1,
        totalCount: 1,
      });
    });

    it("should clear all todos", async () => {
      // Add todos
      await tool.execute({
        action: "add",
        todos: [
          { content: "Task 1", status: "pending" },
          { content: "Task 2", status: "pending" },
        ],
      });

      // Clear all
      const clearResult = await tool.execute({
        action: "clear",
      });

      expect(clearResult).toMatchObject({
        success: true,
        cleared: 2,
        totalCount: 0,
      });
    });

    it("should respect maxTodos configuration", async () => {
      // Try to add 15 todos (limit is 10)
      const todos = Array.from({ length: 15 }, (_, i) => ({
        content: `Task ${i + 1}`,
        status: "pending" as const,
      }));

      const result = await tool.execute({
        action: "add",
        todos,
      });

      expect(result).toMatchObject({
        success: false,
      });
      expect((result as { error: string }).error).toContain("exceed limit");
    });

    it("should return error for add without todos", async () => {
      const result = await tool.execute({
        action: "add",
        todos: [],
      });

      expect(result).toMatchObject({
        success: false,
        error: "No todos provided for add action",
      });
    });

    it("should return error for remove without ids", async () => {
      const result = await tool.execute({
        action: "remove",
        ids: [],
      });

      expect(result).toMatchObject({
        success: false,
        error: "No IDs provided for remove action",
      });
    });
  });

  // ==========================================================================
  // State Persistence Tests
  // ==========================================================================

  describe("state persistence", () => {
    it("should persist todos in afterAgent", async () => {
      const mw = createTodoListMiddleware({ persist: true });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState());
      const runtime = createTestRuntime();

      // Run beforeAgent and beforeModel to set up
      await pipeline.executeBeforeAgent(state, runtime);
      await pipeline.executeBeforeModel(state, runtime);

      const tool = (runtime.context._mwTools as AgentTool[])[0];

      // Add a todo
      await tool.execute({
        action: "add",
        todos: [{ content: "Persistent task", status: "pending" }],
      });

      // Run afterAgent to persist
      const result = await pipeline.executeAfterAgent(state, runtime);

      expect(result.state._mwTodos).toHaveLength(1);
      expect((result.state._mwTodos as TodoItem[])[0].content).toBe("Persistent task");
    });

    it("should load persisted todos in beforeAgent", async () => {
      const mw = createTodoListMiddleware({ persist: true });
      const pipeline = new AgentMiddlewarePipeline([mw]);

      // State with existing todos
      const existingTodos: TodoItem[] = [
        {
          id: "todo_123",
          content: "Existing task",
          status: "pending",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];

      const state = pipeline.initializeState(createTestState(), {
        _mwTodos: existingTodos,
      });
      const runtime = createTestRuntime();

      // Run middleware
      await pipeline.executeBeforeAgent(state, runtime);
      await pipeline.executeBeforeModel(state, runtime);

      const tool = (runtime.context._mwTools as AgentTool[])[0];

      // Add another todo
      await tool.execute({
        action: "add",
        todos: [{ content: "New task", status: "pending" }],
      });

      // Persist
      const result = await pipeline.executeAfterAgent(state, runtime);

      // Should have both todos
      expect(result.state._mwTodos).toHaveLength(2);
    });
  });

  // ==========================================================================
  // State Schema Tests
  // ==========================================================================

  describe("state schema", () => {
    it("should initialize _mwTodos to empty array", () => {
      const mw = createTodoListMiddleware();
      const pipeline = new AgentMiddlewarePipeline([mw]);

      const state = pipeline.initializeState(createTestState());

      expect(state._mwTodos).toEqual([]);
    });
  });
});
