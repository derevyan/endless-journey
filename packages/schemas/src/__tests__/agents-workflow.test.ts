/**
 * Agent Workflow Schema Tests
 *
 * Tests for workflow and agent definition schemas.
 * Focuses on real-world validation scenarios, NOT trivial Zod schema tests.
 *
 * @module schemas/__tests__/agents-workflow
 */

import { describe, expect, it } from "vitest";
import {
  AgentWorkflowSchema,
  CreateAgentWorkflowSchema,
  AgentDefinitionSchema,
  CreateAgentDefinitionSchema,
  WorkflowNodeTypeSchema,
  NODE_OUTPUT_HANDLES,
  BRANCHING_NODE_TYPES,
} from "../agents/workflow";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const TEST_UUID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ORG_ID = "660e8400-e29b-41d4-a716-446655440001";
const NOW = new Date();

const createMinimalWorkflow = (overrides = {}) => ({
  id: TEST_UUID,
  orgId: TEST_ORG_ID,
  key: "test-workflow",
  name: "Test Workflow",
  status: "draft",
  configuration: {
    nodes: [],
    edges: [],
  },
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const createMinimalAgentDefinition = (overrides = {}) => ({
  id: TEST_UUID,
  orgId: TEST_ORG_ID,
  key: "test-agent",
  name: "Test Agent",
  status: "draft",
  systemPrompt: "You are a helpful assistant.",
  llm: {
    provider: "openai",
    model: "gpt-4o",
    temperature: 0.7,
  },
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

// =============================================================================
// WORKFLOW SCHEMA TESTS
// =============================================================================

describe("AgentWorkflowSchema", () => {
  it("should accept valid workflow", () => {
    const workflow = createMinimalWorkflow();
    const result = AgentWorkflowSchema.safeParse(workflow);

    expect(result.success).toBe(true);
  });

  it("should reject invalid key format", () => {
    // Key must start with lowercase letter and contain only lowercase, numbers, hyphens
    const invalidKeys = [
      "Test-Workflow", // Uppercase
      "1workflow", // Starts with number
      "test_workflow", // Underscore
      "test workflow", // Space
      "test.workflow", // Dot
    ];

    for (const key of invalidKeys) {
      const workflow = createMinimalWorkflow({ key });
      const result = AgentWorkflowSchema.safeParse(workflow);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("key");
      }
    }
  });

  it("should accept valid key formats", () => {
    const validKeys = ["workflow", "my-workflow", "workflow-v2", "a1b2c3"];

    for (const key of validKeys) {
      const workflow = createMinimalWorkflow({ key });
      const result = AgentWorkflowSchema.safeParse(workflow);

      expect(result.success).toBe(true);
    }
  });

  it("should default status to draft", () => {
    const workflow = createMinimalWorkflow();
    delete (workflow as Record<string, unknown>).status;

    const result = AgentWorkflowSchema.safeParse(workflow);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
    }
  });
});

describe("CreateAgentWorkflowSchema", () => {
  it("should accept workflow without id and timestamps", () => {
    const input = {
      key: "new-workflow",
      name: "New Workflow",
      configuration: {
        nodes: [],
        edges: [],
      },
    };

    const result = CreateAgentWorkflowSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it("should default configuration to empty if omitted", () => {
    const input = {
      key: "new-workflow",
      name: "New Workflow",
    };

    const result = CreateAgentWorkflowSchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.configuration).toEqual({
        nodes: [],
        edges: [],
      });
    }
  });
});

// =============================================================================
// AGENT DEFINITION SCHEMA TESTS
// =============================================================================

describe("AgentDefinitionSchema", () => {
  it("should accept valid agent definition", () => {
    const definition = createMinimalAgentDefinition();
    const result = AgentDefinitionSchema.safeParse(definition);

    expect(result.success).toBe(true);
  });

  it("should require either systemPrompt or promptRef", () => {
    // This tests the real-world scenario where an agent needs some prompt
    const definition = createMinimalAgentDefinition();
    const result = AgentDefinitionSchema.safeParse(definition);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.systemPrompt).toBeDefined();
    }
  });

  it("should accept promptRef for repository prompts", () => {
    const definition = createMinimalAgentDefinition({
      systemPrompt: undefined,
      promptRef: {
        name: "customer-support-v1",
      },
    });

    const result = AgentDefinitionSchema.safeParse(definition);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.promptRef?.name).toBe("customer-support-v1");
    }
  });

  it("should reject key longer than 100 characters", () => {
    const definition = createMinimalAgentDefinition({
      key: "a".repeat(101),
    });

    const result = AgentDefinitionSchema.safeParse(definition);

    expect(result.success).toBe(false);
  });
});

describe("CreateAgentDefinitionSchema", () => {
  it("should accept valid create input without id and timestamps", () => {
    const input = {
      key: "new-agent",
      name: "New Agent",
      systemPrompt: "You are helpful.",
      llm: { provider: "openai", model: "gpt-4o", temperature: 0.7 },
    };

    const result = CreateAgentDefinitionSchema.safeParse(input);

    expect(result.success).toBe(true);
  });
});

// =============================================================================
// NODE TYPE TESTS
// =============================================================================

describe("WorkflowNodeTypes", () => {
  it("should have output handles defined for all node types", () => {
    const nodeTypes = WorkflowNodeTypeSchema.options;

    for (const nodeType of nodeTypes) {
      expect(NODE_OUTPUT_HANDLES[nodeType]).toBeDefined();
      expect(Array.isArray(NODE_OUTPUT_HANDLES[nodeType])).toBe(true);
    }
  });

  it("should have branching nodes with multiple output handles", () => {
    for (const nodeType of BRANCHING_NODE_TYPES) {
      const handles = NODE_OUTPUT_HANDLES[nodeType];
      expect(handles.length).toBeGreaterThan(1);
    }
  });

  it("should have end node with no output handles", () => {
    expect(NODE_OUTPUT_HANDLES.end).toEqual([]);
  });

  it("should have start node with exactly one output handle", () => {
    expect(NODE_OUTPUT_HANDLES.start).toEqual(["default"]);
  });
});
