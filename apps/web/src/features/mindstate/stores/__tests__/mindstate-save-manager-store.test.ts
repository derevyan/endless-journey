/**
 * Mindstate Save Manager Store - Unit Tests
 *
 * Tests for atomic version saves, error handling, and state orchestration.
 *
 * Run with: pnpm test:frontend apps/web/src/features/mindstate/stores/__tests__/mindstate-save-manager-store.test.ts
 */

import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { mindstateSaveManagerStore, mindstateSaveManagerActions } from "../mindstate-save-manager-store";
import { builderStore, builderActions } from "../builder-store";
import { mindstateVersionActions } from "../mindstate-version-store";
import { mindstateVersionsApi } from "@/shared/lib/api/mindstate-versions";
import { notify } from "@/shared/lib/ui/notify";

// Mock the APIs and stores
vi.mock("@/shared/lib/api/mindstate-versions", () => ({
  mindstateVersionsApi: {
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    saveVersionAtomic: vi.fn(),
    deleteVersion: vi.fn(),
  },
}));

vi.mock("@/shared/lib/ui/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../mindstate-version-store", () => ({
  mindstateVersionActions: {
    refreshVersions: vi.fn(),
    reset: vi.fn(),
  },
}));

describe("mindstate-save-manager-store", () => {
  const mockDefinitionId = "def-123";

  beforeEach(() => {
    // Reset stores
    mindstateSaveManagerActions.reset();
    builderActions.resetDefinition();
    vi.clearAllMocks();

    // Set up a test definition in builder store
    builderActions.setDefinition({
      id: mockDefinitionId,
      key: "test-def",
      name: "Test Definition",
      description: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
      mainAgentConfig: { name: "main", roleDescription: "Main agent" },
      defaultAgents: [],
      defaultParameters: [],
      analysisMode: "automatic",
      categories: [],
    });
  });

  afterEach(() => {
    mindstateSaveManagerActions.reset();
  });

  // ===========================================================================
  // saveVersion - Success Cases
  // ===========================================================================

  describe("saveVersion - success", () => {
    it("saves version successfully and updates state", async () => {
      const mockResponse = { versionId: "v001" };
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockResolvedValue(mockResponse);

      // Mark definition as dirty by updating it
      builderStore.setState((s) => ({
        ...s,
        definition: { ...s.definition!, name: "Updated" },
        isDirty: true,
      }));

      const result = await mindstateSaveManagerActions.saveVersion();

      expect(result).toBe(true);
      expect(mindstateVersionsApi.saveVersionAtomic).toHaveBeenCalledWith(
        mockDefinitionId,
        expect.objectContaining({
          configuration: expect.any(Object),
          notes: undefined,
        })
      );
      expect(notify.success).toHaveBeenCalledWith(expect.stringContaining("v001"));
      expect(vi.mocked(mindstateVersionActions.refreshVersions)).toHaveBeenCalled();
    });

    it("saves version with optional notes", async () => {
      const mockResponse = { versionId: "v001" };
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockResolvedValue(mockResponse);

      builderStore.setState((s) => ({ ...s, isDirty: true }));

      const result = await mindstateSaveManagerActions.saveVersion("Updated agents");

      expect(result).toBe(true);
      expect(mindstateVersionsApi.saveVersionAtomic).toHaveBeenCalledWith(
        mockDefinitionId,
        expect.objectContaining({
          notes: "Updated agents",
        })
      );
    });

    it("marks definition as clean after successful save", async () => {
      const mockResponse = { versionId: "v001" };
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockResolvedValue(mockResponse);

      builderStore.setState((s) => ({ ...s, isDirty: true }));
      expect(builderStore.state.isDirty).toBe(true);

      await mindstateSaveManagerActions.saveVersion();

      expect(builderStore.state.isDirty).toBe(false);
    });

    it("refreshes version list after successful save", async () => {
      const mockResponse = { versionId: "v001" };
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockResolvedValue(mockResponse);

      builderStore.setState((s) => ({ ...s, isDirty: true }));
      await mindstateSaveManagerActions.saveVersion();

      expect(vi.mocked(mindstateVersionActions.refreshVersions)).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // saveVersion - Error Cases
  // ===========================================================================

  describe("saveVersion - errors", () => {
    it("returns false when already saving", async () => {
      const mockResponse = { versionId: "v001" };
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(mockResponse), 100);
          })
      );

      builderStore.setState((s) => ({ ...s, isDirty: true }));

      // Start first save
      const promise1 = mindstateSaveManagerActions.saveVersion();

      // Try to save again immediately
      const result = await mindstateSaveManagerActions.saveVersion();

      expect(result).toBe(false);
      expect(mindstateVersionsApi.saveVersionAtomic).toHaveBeenCalledTimes(1);

      // Wait for first save to complete
      await promise1;
    });

    it("returns true when definition is not dirty", async () => {
      const result = await mindstateSaveManagerActions.saveVersion();

      expect(result).toBe(true);
      expect(mindstateVersionsApi.saveVersionAtomic).not.toHaveBeenCalled();
    });

    it("handles API errors and shows notification", async () => {
      const error = new Error("Network error");
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockRejectedValue(error);

      builderStore.setState((s) => ({ ...s, isDirty: true }));

      const result = await mindstateSaveManagerActions.saveVersion();

      expect(result).toBe(false);
      expect(notify.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed"),
        expect.any(Object)
      );
    });

    it("sets error state on save failure", async () => {
      const error = new Error("Save failed");
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockRejectedValue(error);

      builderStore.setState((s) => ({ ...s, isDirty: true }));
      await mindstateSaveManagerActions.saveVersion();

      const state = mindstateSaveManagerStore.state;
      expect(state.saveOperation.status).toBe("error");
      expect(state.saveOperation.lastError).toBeTruthy();
    });
  });

  // ===========================================================================
  // saveVersion - Edge Cases
  // ===========================================================================

  describe("saveVersion - edge cases", () => {
    it("returns false when no definition to save", async () => {
      builderActions.resetDefinition();
      builderStore.setState((s) => ({ ...s, isDirty: true }));

      const result = await mindstateSaveManagerActions.saveVersion();

      expect(result).toBe(false);
      expect(notify.error).toHaveBeenCalled();
    });

    it("sets isSaving flag during save", async () => {
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ versionId: "v001" }), 50);
          })
      );

      builderStore.setState((s) => ({ ...s, isDirty: true }));

      const savePromise = mindstateSaveManagerActions.saveVersion();

      // Check state while saving
      expect(mindstateSaveManagerStore.state.isSaving).toBe(true);

      await savePromise;

      expect(mindstateSaveManagerStore.state.isSaving).toBe(false);
    });

    it("clears isSaving flag on error", async () => {
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockRejectedValue(
        new Error("API error")
      );

      builderStore.setState((s) => ({ ...s, isDirty: true }));
      await mindstateSaveManagerActions.saveVersion();

      expect(mindstateSaveManagerStore.state.isSaving).toBe(false);
    });
  });

  // ===========================================================================
  // reset
  // ===========================================================================

  describe("reset", () => {
    it("clears all save manager state", async () => {
      // Set some state
      builderStore.setState((s) => ({ ...s, isDirty: true }));
      const mockError = new Error("Test error");
      mindstateSaveManagerStore.setState((s) => ({
        ...s,
        saveOperation: {
          status: "error" as const,
          attemptCount: 2,
          lastError: mockError,
          lastAttemptAt: Date.now(),
        },
      }));

      mindstateSaveManagerActions.reset();

      const state = mindstateSaveManagerStore.state;
      expect(state.isSaving).toBe(false);
      expect(state.saveOperation.status).toBe("idle");
      expect(state.saveOperation.attemptCount).toBe(0);
      expect(state.saveOperation.lastError).toBeNull();
      expect(state.saveOperation.lastAttemptAt).toBeNull();
    });
  });

  // ===========================================================================
  // Configuration Preparation
  // ===========================================================================

  describe("configuration preparation", () => {
    it("includes all required configuration fields", async () => {
      const mockResponse = { versionId: "v001" };
      vi.mocked(mindstateVersionsApi.saveVersionAtomic).mockResolvedValue(mockResponse);

      const definition = {
        ...builderStore.state.definition!,
        mainAgentConfig: { name: "updated", roleDescription: "Updated" },
        defaultAgents: [{ id: "agent1", name: "Agent 1" }],
        defaultParameters: [{ id: "param1", name: "Param 1" }],
        analysisMode: "manual" as const,
        categories: ["cat1", "cat2"],
      };

      builderActions.setDefinition(definition);
      builderStore.setState((s) => ({ ...s, isDirty: true }));

      await mindstateSaveManagerActions.saveVersion();

      const callArgs = vi.mocked(mindstateVersionsApi.saveVersionAtomic).mock.calls[0];
      const config = callArgs[1].configuration;

      expect(config.mainAgentConfig).toEqual(definition.mainAgentConfig);
      expect(config.defaultAgents).toEqual(definition.defaultAgents);
      expect(config.defaultParameters).toEqual(definition.defaultParameters);
      expect(config.analysisMode).toBe("manual");
      expect(config.categories).toEqual(["cat1", "cat2"]);
    });
  });
});
