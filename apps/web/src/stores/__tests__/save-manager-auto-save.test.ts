/**
 * Tests for saveManager auto-save registry.
 *
 * Verifies:
 * - active handler is flushed
 * - latest handler replaces prior handler
 * - unregister clears active handler
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveManagerActions, saveManagerStore } from "@/stores/save-manager-store";

describe("save-manager auto-save", () => {
  beforeEach(() => {
    saveManagerStore.setState((state) => ({
      ...state,
      activeEditorId: null,
      activeEditorHandler: null,
      formDirtyMap: {},
      journeyDirty: false,
    }));
  });

  it("flushes the active editor handler", async () => {
    const handler = vi.fn().mockResolvedValue(true);
    saveManagerActions.registerEditor("node-1", handler);

    const result = await saveManagerActions.flushActiveEditor();

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("returns true when no handler is registered", async () => {
    const result = await saveManagerActions.flushActiveEditor();

    expect(result).toBe(true);
  });

  it("uses the latest handler when replaced", async () => {
    const handler1 = vi.fn().mockResolvedValue(true);
    const handler2 = vi.fn().mockResolvedValue(true);

    saveManagerActions.registerEditor("node-1", handler1);
    saveManagerActions.registerEditor("node-2", handler2);

    await saveManagerActions.flushActiveEditor();

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("clears the handler on unregister", async () => {
    const handler = vi.fn().mockResolvedValue(true);

    saveManagerActions.registerEditor("node-1", handler);
    saveManagerActions.unregisterEditor("node-1");

    const result = await saveManagerActions.flushActiveEditor();

    expect(result).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });
});
