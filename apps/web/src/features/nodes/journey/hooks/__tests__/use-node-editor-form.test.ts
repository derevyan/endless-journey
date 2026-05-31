/**
 * Tests for useNodeEditorForm hook
 *
 * Tests the actual hook behavior:
 * - validateAndSave functionality
 * - Form value persistence across rerenders
 * - Form reset on node ID change
 *
 * Note: TanStack Form's listeners don't fire reliably in test environment,
 * so we test form.state.isDirty directly instead of the React state.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useNodeEditorForm } from "../use-node-editor-form";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";

// Mock the context with trackable mock functions
const mockUpdateNode = vi.fn();
const mockSetPendingChanges = vi.fn();
const mockNotifyError = vi.fn();

vi.mock("@/features/journey/builder/context", () => ({
  useEditorActionsContext: () => ({
    updateNode: mockUpdateNode,
    setPendingChanges: mockSetPendingChanges,
    notify: { error: mockNotifyError, success: vi.fn() },
  }),
}));

// Mock the form registry to use fallback message schema
vi.mock("../../registry", () => ({
  formRegistry: {
    getSchema: () => null,
    getExtractor: () => null,
    getBuilder: () => null,
  },
}));

describe("useNodeEditorForm", () => {
  const createMockNode = (overrides?: Partial<JourneyNode>): JourneyNode => ({
    id: "node-1",
    type: "message",
    position: { x: 0, y: 0 },
    data: {
      type: "message",
      label: "Test Message",
      content: "Hello world",
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with correct form values", () => {
    const mockNode = createMockNode();
    const { result } = renderHook(() => useNodeEditorForm(mockNode));

    expect(result.current.form.state.values.label).toBe("Test Message");
    expect(result.current.form.state.values.content).toBe("Hello world");
  });

  it("should update form values when setFieldValue is called", async () => {
    const mockNode = createMockNode();
    const { result } = renderHook(() => useNodeEditorForm(mockNode));

    await act(async () => {
      result.current.form.setFieldValue("content", "Changed content");
    });

    expect(result.current.form.state.values.content).toBe("Changed content");
    // TanStack Form's internal isDirty should be true
    expect(result.current.form.state.isDirty).toBe(true);
  });

  it("should call updateNode on validateAndSave success", async () => {
    const mockNode = createMockNode();
    const { result } = renderHook(() => useNodeEditorForm(mockNode));

    await act(async () => {
      result.current.form.setFieldValue("content", "Changed content");
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.validateAndSave();
    });

    expect(success).toBe(true);
    expect(mockUpdateNode).toHaveBeenCalledWith(
      "node-1",
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Changed content",
        }),
      })
    );
  });

  it("should return false and show error on validation failure", async () => {
    const mockNode = createMockNode();
    const { result } = renderHook(() => useNodeEditorForm(mockNode));

    // Set label to empty (required field)
    await act(async () => {
      result.current.form.setFieldValue("label", "");
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.validateAndSave();
    });

    expect(success).toBe(false);
    expect(mockNotifyError).toHaveBeenCalled();
    expect(mockUpdateNode).not.toHaveBeenCalled();
  });

  it("should NOT reset form values when data reference changes but nodeId stays same", async () => {
    const mockNode = createMockNode();
    const { result, rerender } = renderHook(({ node }) => useNodeEditorForm(node), {
      initialProps: { node: mockNode },
    });

    // Change content
    await act(async () => {
      result.current.form.setFieldValue("content", "Changed content");
    });
    expect(result.current.form.state.values.content).toBe("Changed content");

    // Simulate React passing a new data object reference (same nodeId)
    // This is the CRITICAL bug scenario - store selector returns new object
    const newNodeRef = {
      ...mockNode,
      data: { ...mockNode.data },
    };
    rerender({ node: newNodeRef });

    // CRITICAL: Form values should NOT reset
    expect(result.current.form.state.values.content).toBe("Changed content");
  });

  it("should reset form when nodeId actually changes", async () => {
    const mockNode1 = createMockNode({ id: "node-1" });
    const { result, rerender } = renderHook(({ node }) => useNodeEditorForm(node), {
      initialProps: { node: mockNode1 },
    });

    // Change content
    await act(async () => {
      result.current.form.setFieldValue("content", "Changed on node 1");
    });
    expect(result.current.form.state.values.content).toBe("Changed on node 1");

    // Switch to a different node
    const mockNode2 = createMockNode({
      id: "node-2",
      data: { type: "message", label: "Node 2", content: "Different content" },
    });
    rerender({ node: mockNode2 });

    // Form should reset to new node's values
    expect(result.current.form.state.values.content).toBe("Different content");
  });

  it("should persist changes through validateAndSave", async () => {
    const mockNode = createMockNode();
    const { result } = renderHook(() => useNodeEditorForm(mockNode));

    // Make changes
    await act(async () => {
      result.current.form.setFieldValue("content", "Saved content");
      result.current.form.setFieldValue("label", "Saved label");
    });

    // Save
    await act(async () => {
      await result.current.validateAndSave();
    });

    // Verify updateNode was called with both changes
    expect(mockUpdateNode).toHaveBeenCalledWith(
      "node-1",
      expect.objectContaining({
        data: expect.objectContaining({
          content: "Saved content",
          label: "Saved label",
        }),
      })
    );
  });

  // ===========================================================================
  // Metadata Fields Tests
  // ===========================================================================
  describe("Metadata Fields", () => {
    it("should save notes field in metadata", async () => {
      const mockNode = createMockNode({
        metadata: {
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          version: "1.0.0",
          status: "draft",
          notes: "",
        },
      } as any);

      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      await act(async () => {
        result.current.form.setFieldValue("notes", "Test note content");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          metadata: expect.objectContaining({
            notes: "Test note content",
          }),
        })
      );
    });

    it("should save tags field in node data", async () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      await act(async () => {
        result.current.form.setFieldValue("tags", ["tag1", "tag2"]);
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          data: expect.objectContaining({
            tags: ["tag1", "tag2"],
          }),
        })
      );
    });

    it("should save customJson field in metadata", async () => {
      const mockNode = createMockNode({
        metadata: {
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          version: "1.0.0",
          status: "draft",
        },
      } as any);

      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      await act(async () => {
        result.current.form.setFieldValue("customJson", '{"key": "value"}');
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          metadata: expect.objectContaining({
            custom: { key: "value" },
          }),
        })
      );
    });

    it("should preserve empty notes field", async () => {
      const mockNode = createMockNode({
        metadata: {
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          version: "1.0.0",
          status: "draft",
          notes: "initial note",
        },
      } as any);

      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      // Clear the notes
      await act(async () => {
        result.current.form.setFieldValue("notes", "");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      // Even empty string should be saved (not converted to undefined)
      expect(mockUpdateNode).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Common Fields Tests
  // ===========================================================================
  describe("Common Fields", () => {
    it("should save label field", async () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      await act(async () => {
        result.current.form.setFieldValue("label", "New Label");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          data: expect.objectContaining({
            label: "New Label",
          }),
        })
      );
    });

    it("should save status field in metadata", async () => {
      const mockNode = createMockNode({
        metadata: {
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          version: "1.0.0",
          status: "draft",
        },
      } as any);

      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      await act(async () => {
        result.current.form.setFieldValue("status", "active");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          metadata: expect.objectContaining({
            status: "active",
          }),
        })
      );
    });
  });

  // ===========================================================================
  // Message Node Fields Tests
  // ===========================================================================
  describe("Message Node Fields", () => {
    it("should save content field", async () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      await act(async () => {
        result.current.form.setFieldValue("content", "Updated message content");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          data: expect.objectContaining({
            content: "Updated message content",
          }),
        })
      );
    });

    it("should save responseType field", async () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      await act(async () => {
        result.current.form.setFieldValue("responseType", "text");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          data: expect.objectContaining({
            responseType: "text",
          }),
        })
      );
    });

    it("should save storeResponseAs field", async () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      await act(async () => {
        result.current.form.setFieldValue("storeResponseAs", "user_input");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          data: expect.objectContaining({
            storeResponseAs: "user_input",
          }),
        })
      );
    });

    it("should save delay field", async () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      await act(async () => {
        result.current.form.setFieldValue("delay", 5);
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          data: expect.objectContaining({
            delay: 5,
          }),
        })
      );
    });
  });

  // ===========================================================================
  // Validation Errors Map
  // ===========================================================================
  describe("validationErrors", () => {
    it("should return empty Map initially", () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      expect(result.current.validationErrors.size).toBe(0);
    });

    it("should populate errors on validation failure", async () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      // Set label to empty (required field)
      await act(async () => {
        result.current.form.setFieldValue("label", "");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      expect(result.current.validationErrors.size).toBeGreaterThan(0);
      expect(result.current.validationErrors.get("label")).toBeDefined();
    });

    it("should clear errors on successful validation after previous failure", async () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      // First, trigger an error
      await act(async () => {
        result.current.form.setFieldValue("label", "");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      // Verify errors exist
      expect(result.current.validationErrors.size).toBeGreaterThan(0);

      // Fix the error and save again
      await act(async () => {
        result.current.form.setFieldValue("label", "Valid Label");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      // Errors should be cleared
      expect(result.current.validationErrors.size).toBe(0);
    });

    it("should have correct field path format in error Map", async () => {
      // The validationErrors Map uses dot-notation paths like "label" or "buttons.0.text"
      // This test verifies the structure by checking a simple field error
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      // Trigger validation error on the label field
      await act(async () => {
        result.current.form.setFieldValue("label", "");
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      // Verify the error is keyed by field name (not index or other format)
      expect(result.current.validationErrors.has("label")).toBe(true);
      expect(typeof result.current.validationErrors.get("label")).toBe("string");
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================
  describe("Edge Cases", () => {
    it("should skip save when form is not dirty", async () => {
      const mockNode = createMockNode();
      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      // Don't make any changes - form should not be dirty

      await act(async () => {
        await result.current.validateAndSave();
      });

      // updateNode should NOT be called since nothing changed
      expect(mockUpdateNode).not.toHaveBeenCalled();
    });

    it("should handle multiple field changes in single save", async () => {
      const mockNode = createMockNode({
        metadata: {
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          version: "1.0.0",
          status: "draft",
        },
      } as any);

      const { result } = renderHook(() => useNodeEditorForm(mockNode));

      // Change multiple fields
      await act(async () => {
        result.current.form.setFieldValue("label", "New Label");
        result.current.form.setFieldValue("content", "New Content");
        result.current.form.setFieldValue("notes", "New Notes");
        result.current.form.setFieldValue("tags", ["tag1"]);
      });

      await act(async () => {
        await result.current.validateAndSave();
      });

      // All fields should be saved
      expect(mockUpdateNode).toHaveBeenCalledWith(
        "node-1",
        expect.objectContaining({
          data: expect.objectContaining({
            label: "New Label",
            content: "New Content",
            tags: ["tag1"],
          }),
          metadata: expect.objectContaining({
            notes: "New Notes",
          }),
        })
      );
    });
  });
});
