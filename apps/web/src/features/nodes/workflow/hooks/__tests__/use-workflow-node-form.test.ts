/**
 * Tests for useWorkflowNodeForm hook
 *
 * Tests the critical hook behavior:
 * - Form value persistence across rerenders
 * - Form reset on node ID change
 *
 * Note: These tests focus on the CRITICAL bug fix - that form values
 * are NOT reset when React passes new data object references.
 */

import { renderHook, act } from "@testing-library/react";
import type { WorkflowNodeType } from "@journey/schemas";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildWorkflowNodeData, extractWorkflowValues, useWorkflowNodeForm } from "../use-workflow-node-form";

import "@/features/nodes/workflow/definitions";

// Use vi.hoisted to define mock functions before vi.mock is hoisted
const { mockUpdateNodeData, mockMarkFormDirty, mockNotifySuccess, mockNotifyError } = vi.hoisted(() => ({
  mockUpdateNodeData: vi.fn(),
  mockMarkFormDirty: vi.fn(),
  mockNotifySuccess: vi.fn(),
  mockNotifyError: vi.fn(),
}));

// Mock store actions
vi.mock("@/features/agent-workflows/stores/agent-workflow-store", () => ({
  agentWorkflowActions: {
    updateNodeData: mockUpdateNodeData,
    markFormDirty: mockMarkFormDirty,
  },
}));

// Mock notify
vi.mock("@/shared/lib/ui/notify", () => ({
  notify: {
    error: mockNotifyError,
    success: mockNotifySuccess,
  },
}));

describe("useWorkflowNodeForm", () => {
  // Data must match AgentNodeConfig structure (extractor looks for data.llm.model, etc.)
  const createMockOptions = (overrides?: Partial<Parameters<typeof useWorkflowNodeForm>[0]>) => ({
    nodeId: "agent-1",
    nodeType: "agent" as const,
    data: {
      name: "Test Agent",
      llm: {
        model: "claude-sonnet-4-20250514",
        reasoningEffort: "medium",
        temperature: 0.7,
      },
    },
    formConfig: {
      autoSave: false,
    },
    ...overrides,
  });

  // Test fixtures for workflow node form extraction/building
  const testFixtures = {
    guard: {
      nodeData: {
        workers: ["safety_guard", "injection_guard"],
        blockedMessage: "Cannot help with that.",
        terminateOnBlock: true,
      },
      expectedFormValues: {
        name: undefined,
        workers: ["safety_guard", "injection_guard"],
        blockedMessage: "Cannot help with that.",
        terminateOnBlock: true,
      },
    },
    mcp: {
      nodeData: {
        server: "my-server",
        tool: "my-tool",
        params: { key: "value" },
        timeout: 30000,
        onError: "fail",
        maxRetries: 2,
      },
      expectedFormValues: {
        name: undefined,
        server: "my-server",
        tool: "my-tool",
        params: { key: "value" },
        timeout: 30000,
        onError: "fail",
        maxRetries: 2,
      },
    },
    if_else: {
      nodeData: {
        conditionType: "expression",
        condition: {
          left: "result.success",
          operator: "===",
          right: true,
        },
      },
      expectedFormValues: {
        name: undefined,
        conditionType: "expression",
        left: "result.success",
        operator: "===",
        right: true,
      },
    },
    user_approval: {
      nodeData: {
        message: "Please approve this action.",
        timeoutSeconds: 300,
        timeoutAction: "skip",
      },
      expectedFormValues: {
        name: undefined,
        message: "Please approve this action.",
        timeoutSeconds: 300,
        timeoutAction: "skip",
      },
    },
    set_state: {
      nodeData: {
        key: "userScore",
        value: 100,
        isTemplate: false,
      },
      expectedFormValues: {
        name: undefined,
        key: "userScore",
        value: 100,
        isTemplate: false,
      },
    },
    transform: {
      nodeData: {
        operation: {
          type: "extractJson",
          sourceVariable: "apiResponse",
        },
        outputVariable: "extractedData",
      },
      expectedFormValues: {
        name: undefined,
        operationType: "extractJson",
        sourceVariable: "apiResponse",
        outputVariable: "extractedData",
      },
    },
    end: {
      nodeData: {
        outputTemplate: "Thank you for your inquiry.",
      },
      expectedFormValues: {
        name: undefined,
        outputTemplate: "Thank you for your inquiry.",
      },
    },
    question_understanding: {
      nodeData: {
        outputVariable: "synthesized_question",
        includeReasoning: true,
      },
      expectedFormValues: {
        name: undefined,
        outputVariable: "synthesized_question",
        includeReasoning: true,
      },
    },
    context: {
      nodeData: {
        sources: [
          {
            type: "memory",
            maxResults: 10,
            autoInject: true,
            recencyBias: 0.3,
          },
        ],
        outputVariable: "contextData",
      },
      expectedFormValues: {
        name: undefined,
        sources: [
          {
            type: "memory",
            maxResults: 10,
            autoInject: true,
            recencyBias: 0.3,
          },
        ],
        outputVariable: "contextData",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with correct form values", () => {
    const options = createMockOptions();
    const { result } = renderHook(() => useWorkflowNodeForm(options));

    expect(result.current.form.state.values).toBeDefined();
    expect(result.current.form.state.values.model).toBe("claude-sonnet-4-20250514");
    expect(result.current.form.state.values.reasoningEffort).toBe("medium");
  });

  it("should update form values when setFieldValue is called", async () => {
    const options = createMockOptions();
    const { result } = renderHook(() => useWorkflowNodeForm(options));

    await act(async () => {
      result.current.form.setFieldValue("reasoningEffort", "high");
    });

    expect(result.current.form.state.values.reasoningEffort).toBe("high");
    // TanStack Form's internal isDirty should be true
    expect(result.current.form.state.isDirty).toBe(true);
  });

  it("should NOT reset form values when data reference changes but nodeId stays same", async () => {
    const options = createMockOptions();
    const { result, rerender } = renderHook(({ opts }) => useWorkflowNodeForm(opts), {
      initialProps: { opts: options },
    });

    // Change reasoningEffort
    await act(async () => {
      result.current.form.setFieldValue("reasoningEffort", "high");
    });
    expect(result.current.form.state.values.reasoningEffort).toBe("high");

    // Simulate React passing a new data object reference (same nodeId)
    // This is the CRITICAL bug scenario - store selector returns new object
    const newOptionsRef = {
      ...options,
      data: { ...options.data },
    };
    rerender({ opts: newOptionsRef });

    // CRITICAL: Form values should NOT reset
    expect(result.current.form.state.values.reasoningEffort).toBe("high");
  });

  it("should retain model change when data reference changes", async () => {
    const options = createMockOptions();
    const { result, rerender } = renderHook(({ opts }) => useWorkflowNodeForm(opts), {
      initialProps: { opts: options },
    });

    // Change model
    await act(async () => {
      result.current.form.setFieldValue("model", "claude-opus-4-20250514");
    });
    expect(result.current.form.state.values.model).toBe("claude-opus-4-20250514");

    // Simulate new data reference
    rerender({ opts: { ...options, data: { ...options.data } } });

    // Model should still be changed
    expect(result.current.form.state.values.model).toBe("claude-opus-4-20250514");
  });

  it("should reset form when nodeId actually changes", async () => {
    const options1 = createMockOptions({ nodeId: "agent-1" });
    const { result, rerender } = renderHook(({ opts }) => useWorkflowNodeForm(opts), {
      initialProps: { opts: options1 },
    });

    // Change reasoningEffort
    await act(async () => {
      result.current.form.setFieldValue("reasoningEffort", "high");
    });
    expect(result.current.form.state.values.reasoningEffort).toBe("high");

    // Switch to different node - form should reset
    const options2 = createMockOptions({
      nodeId: "agent-2",
      data: {
        name: "Agent 2",
        llm: { model: "claude-opus-4-20250514", reasoningEffort: "low", temperature: 0.5 },
      },
    });
    rerender({ opts: options2 });

    // Form should reset to new node's values
    expect(result.current.form.state.values.reasoningEffort).toBe("low");
    expect(result.current.form.state.values.model).toBe("claude-opus-4-20250514");
  });

  it("should track isDirty state", async () => {
    const options = createMockOptions();
    const { result } = renderHook(() => useWorkflowNodeForm(options));

    // Initially not dirty
    expect(result.current.isDirty).toBe(false);

    // After change, form.state.isDirty should be true
    await act(async () => {
      result.current.form.setFieldValue("reasoningEffort", "high");
    });

    expect(result.current.form.state.isDirty).toBe(true);
  });

  // ===========================================================================
  // ValidateAndSave Tests
  // ===========================================================================
  describe("validateAndSave", () => {
    it("should skip save when form is not dirty", async () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useWorkflowNodeForm(options));

      // Don't make any changes

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.validateAndSave();
      });

      expect(success).toBe(true);
      expect(mockUpdateNodeData).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Form State Tests
  // ===========================================================================
  describe("Form State", () => {
    it("should track isSaving state", async () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useWorkflowNodeForm(options));

      expect(result.current.isSaving).toBe(false);
    });

    it("should update form values when setFieldValue is called", async () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useWorkflowNodeForm(options));

      await act(async () => {
        result.current.form.setFieldValue("model", "claude-opus-4-20250514");
      });

      expect(result.current.form.state.values.model).toBe("claude-opus-4-20250514");
    });

    it("should track isDirty after field change", async () => {
      const options = createMockOptions();
      const { result } = renderHook(() => useWorkflowNodeForm(options));

      expect(result.current.form.state.isDirty).toBe(false);

      await act(async () => {
        result.current.form.setFieldValue("temperature", 0.8);
      });

      expect(result.current.form.state.isDirty).toBe(true);
    });
  });

  // ===========================================================================
  // Form Extraction/Building Tests
  // ===========================================================================
  describe("Form Extraction", () => {
    describe.each(Object.entries(testFixtures))(
      "%s node",
      (nodeType, { nodeData, expectedFormValues }) => {
        it("should extract form values from node data", () => {
          const extracted = extractWorkflowValues(nodeType as WorkflowNodeType, nodeData);

          Object.entries(expectedFormValues).forEach(([key, value]) => {
            if (value !== undefined) {
              expect(extracted[key]).toEqual(value);
            }
          });
        });

        it("should handle missing optional fields gracefully", () => {
          const minimalData = { ...nodeData } as Record<string, unknown>;
          delete minimalData.name;

          const extracted = extractWorkflowValues(nodeType as WorkflowNodeType, minimalData);

          expect(extracted).toBeDefined();
          expect(typeof extracted).toBe("object");
        });
      }
    );
  });

  describe("Form Building", () => {
    describe.each(Object.entries(testFixtures))(
      "%s node",
      (nodeType, { expectedFormValues, nodeData }) => {
        it("should build node data from form values", () => {
          const built = buildWorkflowNodeData(
            nodeType as WorkflowNodeType,
            expectedFormValues,
            nodeData
          ) as Record<string, unknown>;

          Object.entries(nodeData).forEach(([key, value]) => {
            expect(built[key]).toEqual(value);
          });
        });
      }
    );
  });
});
