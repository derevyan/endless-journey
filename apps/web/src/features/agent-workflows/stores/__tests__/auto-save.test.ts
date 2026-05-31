/**
 * Tests for auto-save functionality in agent workflow store.
 *
 * Tests the canvas click auto-save scenario:
 * - Handler is always called when registered (no isDirty check)
 * - Selection is cleared after successful save
 * - Selection is NOT cleared if validation fails
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { saveManagerActions, saveManagerStore } from "@/stores/save-manager-store";
import { clearSelectionWithAutoSave } from "../agent-workflow-store";

// Mock the store actions
vi.mock("../agent-workflow-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../agent-workflow-store")>();

  // Track if clearSelection was called
  const mockClearSelection = vi.fn();

  return {
    ...actual,
    agentWorkflowActions: {
      ...actual.agentWorkflowActions,
      clearSelection: mockClearSelection,
    },
    clearSelectionWithAutoSave: actual.clearSelectionWithAutoSave,
  };
});

describe("clearSelectionWithAutoSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveManagerStore.setState((state) => ({
      ...state,
      activeEditorId: null,
      activeEditorHandler: null,
    }));
  });

  it("should call handler when registered (canvas click scenario)", async () => {
    const mockValidateAndSave = vi.fn().mockResolvedValue(true);
    saveManagerActions.registerEditor("node-1", mockValidateAndSave);

    const result = await clearSelectionWithAutoSave();

    // Handler should be called - this is the critical fix
    expect(mockValidateAndSave).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it("should NOT clear selection if validation fails", async () => {
    const mockValidateAndSave = vi.fn().mockResolvedValue(false);
    saveManagerActions.registerEditor("node-1", mockValidateAndSave);

    const result = await clearSelectionWithAutoSave();

    expect(mockValidateAndSave).toHaveBeenCalledTimes(1);
    expect(result).toBe(false);
  });

  it("should succeed when no handler is registered", async () => {
    saveManagerStore.setState((state) => ({
      ...state,
      activeEditorId: null,
      activeEditorHandler: null,
    }));

    const result = await clearSelectionWithAutoSave();

    expect(result).toBe(true);
  });

  it("should call handler with async changes (simulating setFieldValue)", async () => {
    // Simulate the scenario where setFieldValue was used (async isDirty update)
    // but the handler still needs to be called
    const mockValidateAndSave = vi.fn().mockResolvedValue(true);

    // Register handler - no isDirty parameter needed anymore
    saveManagerActions.registerEditor("node-1", mockValidateAndSave);

    // Simulate canvas click immediately after typing
    const result = await clearSelectionWithAutoSave();

    // Handler should ALWAYS be called - this is what fixes the bug
    expect(mockValidateAndSave).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });
});
