/**
 * Mindstate Version Store - Unit Tests
 *
 * Tests for version loading, race condition prevention, and state management.
 *
 * Run with: pnpm test:frontend apps/web/src/features/mindstate/stores/__tests__/mindstate-version-store.test.ts
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { mindstateVersionStore, mindstateVersionActions } from "../mindstate-version-store";
import { mindstateVersionsApi } from "@/shared/lib/api/mindstate-versions";

// Mock the API
vi.mock("@/shared/lib/api/mindstate-versions", () => ({
  mindstateVersionsApi: {
    listVersions: vi.fn(),
    getVersion: vi.fn(),
    saveVersionAtomic: vi.fn(),
    deleteVersion: vi.fn(),
  },
}));

describe("mindstate-version-store", () => {
  const mockDefinitionId = "def-123";
  const mockDefinitionKey = "test-def";

  beforeEach(() => {
    // Reset store state
    mindstateVersionActions.reset();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // setDefinitionId
  // ===========================================================================

  describe("setDefinitionId", () => {
    it("sets definition ID and triggers version load", async () => {
      const mockVersions = [
        {
          id: "v1",
          definitionId: mockDefinitionId,
          versionId: "v001",
          notes: "Initial version",
          createdAt: new Date(),
          configuration: {},
        },
      ];

      vi.mocked(mindstateVersionsApi.listVersions).mockResolvedValue(mockVersions);

      mindstateVersionActions.setDefinitionId(mockDefinitionId);

      // Wait for async load
      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = mindstateVersionStore.state;
      expect(state.definitionId).toBe(mockDefinitionId);
      expect(mindstateVersionsApi.listVersions).toHaveBeenCalledWith(mockDefinitionId);
    });
  });

  // ===========================================================================
  // setDefinitionKey
  // ===========================================================================

  describe("setDefinitionKey", () => {
    it("sets definition key without triggering load", () => {
      mindstateVersionActions.setDefinitionKey(mockDefinitionKey);

      const state = mindstateVersionStore.state;
      expect(state.definitionKey).toBe(mockDefinitionKey);
      expect(mindstateVersionsApi.listVersions).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // loadVersions
  // ===========================================================================

  describe("loadVersions", () => {
    it("loads and stores versions successfully", async () => {
      const mockVersions = [
        {
          id: "v1",
          definitionId: mockDefinitionId,
          versionId: "v002",
          notes: "Second version",
          createdAt: new Date(),
          configuration: {},
        },
        {
          id: "v2",
          definitionId: mockDefinitionId,
          versionId: "v001",
          notes: "First version",
          createdAt: new Date(),
          configuration: {},
        },
      ];

      vi.mocked(mindstateVersionsApi.listVersions).mockResolvedValue(mockVersions);

      mindstateVersionActions.loadVersions(mockDefinitionId);

      // Wait for async load
      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = mindstateVersionStore.state;
      expect(state.versions).toHaveLength(2);
      expect(state.versions[0].versionId).toBe("v002");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("handles empty version list", async () => {
      vi.mocked(mindstateVersionsApi.listVersions).mockResolvedValue([]);

      mindstateVersionActions.loadVersions(mockDefinitionId);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = mindstateVersionStore.state;
      expect(state.versions).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it("handles load errors gracefully", async () => {
      const error = new Error("API error");
      vi.mocked(mindstateVersionsApi.listVersions).mockRejectedValue(error);

      mindstateVersionActions.loadVersions(mockDefinitionId);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = mindstateVersionStore.state;
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });

    it("prevents race conditions by tracking request count", async () => {
      const mockVersions1 = [
        {
          id: "v1",
          definitionId: mockDefinitionId,
          versionId: "v001",
          notes: "First",
          createdAt: new Date(),
          configuration: {},
        },
      ];

      const mockVersions2 = [
        {
          id: "v2",
          definitionId: "def-456",
          versionId: "v001",
          notes: "Second",
          createdAt: new Date(),
          configuration: {},
        },
      ];

      // Setup mock to resolve requests in reverse order (simulating race condition)
      let resolveFirst: ((value: any) => void) | null = null;
      let resolveSecond: ((value: any) => void) | null = null;

      const promise1 = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      const promise2 = new Promise((resolve) => {
        resolveSecond = resolve;
      });

      vi.mocked(mindstateVersionsApi.listVersions).mockImplementation((id) => {
        if (id === mockDefinitionId) {
          return promise1 as Promise<any>;
        }
        return promise2 as Promise<any>;
      });

      // Load first definition
      mindstateVersionActions.loadVersions(mockDefinitionId);

      // Load second definition (this becomes the "latest" request)
      mindstateVersionActions.loadVersions("def-456");

      // Resolve first request (should be ignored)
      resolveFirst?.(mockVersions1);

      // Resolve second request (should be applied)
      resolveSecond?.(mockVersions2);

      await new Promise((resolve) => setTimeout(resolve, 20));

      const state = mindstateVersionStore.state;
      // Should have the second definition's versions since that was the last request
      expect(state.versions).toEqual(mockVersions2);
    });
  });

  // ===========================================================================
  // refreshVersions
  // ===========================================================================

  describe("refreshVersions", () => {
    it("reloads versions for current definition", async () => {
      const initialVersions = [
        {
          id: "v1",
          definitionId: mockDefinitionId,
          versionId: "v001",
          notes: "Initial",
          createdAt: new Date(),
          configuration: {},
        },
      ];

      const updatedVersions = [
        {
          id: "v2",
          definitionId: mockDefinitionId,
          versionId: "v002",
          notes: "Updated",
          createdAt: new Date(),
          configuration: {},
        },
      ];

      vi.mocked(mindstateVersionsApi.listVersions).mockResolvedValueOnce(initialVersions);
      vi.mocked(mindstateVersionsApi.listVersions).mockResolvedValueOnce(updatedVersions);

      mindstateVersionActions.setDefinitionId(mockDefinitionId);
      await new Promise((resolve) => setTimeout(resolve, 10));

      mindstateVersionActions.refreshVersions();
      await new Promise((resolve) => setTimeout(resolve, 10));

      const state = mindstateVersionStore.state;
      expect(state.versions).toEqual(updatedVersions);
      expect(mindstateVersionsApi.listVersions).toHaveBeenCalledTimes(2);
    });

    it("does nothing if no definition ID is set", async () => {
      mindstateVersionActions.refreshVersions();

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mindstateVersionsApi.listVersions).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getVersionData
  // ===========================================================================

  describe("getVersionData", () => {
    it("fetches version data from API", async () => {
      const mockVersionData = {
        data: {
          mainAgentConfig: { name: "test" },
          defaultAgents: [],
          defaultParameters: [],
          analysisMode: "automatic" as const,
          categories: [],
        },
        notes: "Test version",
      };

      vi.mocked(mindstateVersionsApi.getVersion).mockResolvedValue(mockVersionData);

      // Set definitionId first
      mindstateVersionActions.setDefinitionId(mockDefinitionId);

      const result = await mindstateVersionActions.getVersionData("v001");

      expect(result).toEqual(mockVersionData);
      expect(mindstateVersionsApi.getVersion).toHaveBeenCalledWith(mockDefinitionId, "v001");
    });
  });

  // ===========================================================================
  // reset
  // ===========================================================================

  describe("reset", () => {
    it("clears all store state", async () => {
      mindstateVersionActions.setDefinitionId(mockDefinitionId);
      mindstateVersionActions.setDefinitionKey(mockDefinitionKey);

      const state = mindstateVersionStore.state;
      expect(state.definitionId).toBe(mockDefinitionId);
      expect(state.definitionKey).toBe(mockDefinitionKey);

      mindstateVersionActions.reset();

      const resetState = mindstateVersionStore.state;
      expect(resetState.definitionId).toBeNull();
      expect(resetState.definitionKey).toBeNull();
      expect(resetState.versions).toEqual([]);
      expect(resetState.isLoading).toBe(false);
      expect(resetState.error).toBeNull();
    });
  });
});
