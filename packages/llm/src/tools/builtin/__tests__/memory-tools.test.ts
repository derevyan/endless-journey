/**
 * Memory Tools Tests
 *
 * Tests for long-term memory tools:
 * - save_memory tool
 * - recall_memories tool
 * - buildMemoryTools builder function
 * - Graceful degradation and error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSaveMemoryTool,
  createRecallMemoriesTool,
  buildMemoryTools,
} from "../memory-tools";
import type { BuiltinToolContext } from "../types";
import type { IMemoryService, SharedServiceContext } from "@journey/schemas";

// Helper type for tool results in tests (AgentTool.execute returns unknown)
type ToolResult = Record<string, unknown>;

// Create mock memory service factory
function createMockMemoryService(): IMemoryService {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([
      { key: "user_name", content: "John Doe", memoryType: "semantic", similarity: 0.95 },
      { key: "food_preference", content: "Loves pizza", memoryType: "preference", similarity: 0.82 },
    ]),
    getRecent: vi.fn().mockResolvedValue([
      { key: "user_name", content: "John Doe", memoryType: "semantic" },
    ]),
    get: vi.fn().mockResolvedValue({ key: "user_name", content: "John Doe", memoryType: "semantic" }),
    delete: vi.fn().mockResolvedValue(true),
  };
}

// Create mock services factory
function createMockServices(memory?: IMemoryService): SharedServiceContext {
  return {
    variable: {
      getValue: vi.fn(),
      setValue: vi.fn(),
      getAll: vi.fn(),
      executeOperation: vi.fn(),
      executeAction: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    },
    template: {
      substitute: vi.fn((template: string) => template),
      resolve: vi.fn(),
      hasVariables: vi.fn(),
      extractVariables: vi.fn(),
    },
    messenger: {
      sendMessage: vi.fn(),
      sendButtons: vi.fn(),
      sendMedia: vi.fn(),
    },
    memory,
    has: (service) => service === "memory" ? !!memory : false,
  };
}

// Create mock context factory
function createMockContext(memory?: IMemoryService): BuiltinToolContext {
  return {
    nodeId: "test-agent-node",
    services: createMockServices(memory),
    session: {
      sessionId: "test-session",
      journeyId: "test-journey",
      userId: "test-user",
      currentNodeId: "test-agent-node",
    },
    clientData: { id: "client-123" },
    log: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

describe("Memory Tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildMemoryTools", () => {
    it("returns both tools when both are enabled and memory service exists", () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);

      const tools = buildMemoryTools(context, { saveMemory: true, recallMemories: true });

      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toEqual(["save_memory", "recall_memories"]);
    });

    it("returns only save_memory when recallMemories is disabled", () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);

      const tools = buildMemoryTools(context, { saveMemory: true, recallMemories: false });

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("save_memory");
    });

    it("returns only recall_memories when saveMemory is disabled", () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);

      const tools = buildMemoryTools(context, { saveMemory: false, recallMemories: true });

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("recall_memories");
    });

    it("returns empty array when no memory service is provided", () => {
      const context = createMockContext(undefined);

      const tools = buildMemoryTools(context, { saveMemory: true, recallMemories: true });

      expect(tools).toHaveLength(0);
    });

    it("returns empty array when both tools are disabled", () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);

      const tools = buildMemoryTools(context, { saveMemory: false, recallMemories: false });

      expect(tools).toHaveLength(0);
    });
  });

  describe("save_memory tool", () => {
    it("saves memory successfully", async () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);
      const tool = createSaveMemoryTool(context);

      const result = (await tool.execute({
        key: "user_name",
        content: "John Doe",
        memoryType: "semantic",
      })) as ToolResult;

      expect(result.success).toBe(true);
      expect(result.message).toContain("Remembered");
      expect(result.key).toBe("user_name");
      expect(memoryService.save).toHaveBeenCalledWith({
        key: "user_name",
        content: "John Doe",
        memoryType: "semantic",
      });
    });

    it("saves memory without memoryType (defaults to undefined)", async () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);
      const tool = createSaveMemoryTool(context);

      await tool.execute({ key: "birthday", content: "January 15" });

      expect(memoryService.save).toHaveBeenCalledWith({
        key: "birthday",
        content: "January 15",
        memoryType: undefined,
      });
    });

    it("returns error when memory service is not available", async () => {
      const context = createMockContext(undefined);
      const tool = createSaveMemoryTool(context);

      const result = (await tool.execute({ key: "test", content: "test value" })) as ToolResult;

      expect(result.error).toBe("Memory not available");
      expect(context.log.warn).toHaveBeenCalled();
    });

    it("handles save errors gracefully", async () => {
      const memoryService = createMockMemoryService();
      vi.mocked(memoryService.save).mockRejectedValueOnce(new Error("Database connection failed"));
      const context = createMockContext(memoryService);
      const tool = createSaveMemoryTool(context);

      const result = (await tool.execute({ key: "test", content: "test value" })) as ToolResult;

      expect(result.error).toBe("Save failed");
      expect(result.message).toContain("Database connection failed");
      expect(context.log.error).toHaveBeenCalled();
    });

    it("has correct schema with validation constraints", () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);
      const tool = createSaveMemoryTool(context);

      expect(tool.name).toBe("save_memory");
      expect(tool.description).toContain("Save a fact");
      expect(tool.schema).toBeDefined();
    });
  });

  describe("recall_memories tool", () => {
    it("searches memories successfully", async () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);
      const tool = createRecallMemoriesTool(context);

      const result = (await tool.execute({ query: "what is the user's name", limit: 5 })) as ToolResult;

      expect(result.found).toBe(true);
      expect(result.count).toBe(2);
      const memories = result.memories as Record<string, unknown>[];
      expect(memories.length).toBe(2);
      expect(memories[0].key).toBe("user_name");
      expect(memories[0].content).toBe("John Doe");
      expect(memories[0].relevance).toBe(0.95);
      expect(memoryService.search).toHaveBeenCalledWith("what is the user's name", 5);
    });

    it("uses default limit of 5 when not specified", async () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);
      const tool = createRecallMemoriesTool(context);

      await tool.execute({ query: "food preferences" });

      expect(memoryService.search).toHaveBeenCalledWith("food preferences", 5);
    });

    it("returns found: false when no memories match", async () => {
      const memoryService = createMockMemoryService();
      vi.mocked(memoryService.search).mockResolvedValueOnce([]);
      const context = createMockContext(memoryService);
      const tool = createRecallMemoriesTool(context);

      const result = (await tool.execute({ query: "something unknown" })) as ToolResult;

      expect(result.found).toBe(false);
      expect(result.message).toContain("No relevant memories");
      expect(result.memories).toEqual([]);
    });

    it("returns error when memory service is not available", async () => {
      const context = createMockContext(undefined);
      const tool = createRecallMemoriesTool(context);

      const result = (await tool.execute({ query: "test query" })) as ToolResult;

      expect(result.error).toBe("Memory not available");
      expect(context.log.warn).toHaveBeenCalled();
    });

    it("handles search errors gracefully", async () => {
      const memoryService = createMockMemoryService();
      vi.mocked(memoryService.search).mockRejectedValueOnce(new Error("Vector search failed"));
      const context = createMockContext(memoryService);
      const tool = createRecallMemoriesTool(context);

      const result = (await tool.execute({ query: "test query" })) as ToolResult;

      expect(result.error).toBe("Search failed");
      expect(result.message).toContain("Vector search failed");
      expect(context.log.error).toHaveBeenCalled();
    });

    it("rounds relevance scores to 2 decimal places", async () => {
      const memoryService = createMockMemoryService();
      vi.mocked(memoryService.search).mockResolvedValueOnce([
        { key: "test", content: "test content", memoryType: "semantic", similarity: 0.87654321 },
      ]);
      const context = createMockContext(memoryService);
      const tool = createRecallMemoriesTool(context);

      const result = (await tool.execute({ query: "test" })) as ToolResult;

      expect((result.memories as Record<string, unknown>[])[0].relevance).toBe(0.88); // Rounded from 0.87654321
    });
  });

  describe("end-to-end workflow", () => {
    it("save and recall memories work together", async () => {
      const memoryService = createMockMemoryService();
      const context = createMockContext(memoryService);
      const tools = buildMemoryTools(context, { saveMemory: true, recallMemories: true });

      const saveTool = tools.find((t) => t.name === "save_memory")!;
      const recallTool = tools.find((t) => t.name === "recall_memories")!;

      // Save a memory
      const saveResult = (await saveTool.execute({
        key: "favorite_color",
        content: "Blue is their favorite color",
        memoryType: "preference",
      })) as ToolResult;
      expect(saveResult.success).toBe(true);

      // Now search for it (mock returns predefined results but validates the flow)
      const recallResult = (await recallTool.execute({ query: "favorite color", limit: 3 })) as ToolResult;
      expect(recallResult.found).toBe(true);
      expect(memoryService.search).toHaveBeenCalledWith("favorite color", 3);
    });
  });
});
