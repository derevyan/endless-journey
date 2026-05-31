/**
 * Session Replay Tests
 *
 * Tests for incremental replay caching, forward/backward seeking,
 * and message generation from interactions.
 */

import type { InteractionEvent } from "@journey/schemas";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearReplayCache,
  getAllMessages,
  getInteractionAt,
  getNodeAtIndex,
  replayUpToIndex,
  type NodeWithButtons,
} from "../session-replay";

// Helper to create a mock interaction event
function createMockInteraction(
  id: string,
  type: InteractionEvent["type"],
  nodeId: string,
  payload: Record<string, unknown> = {}
): InteractionEvent {
  return {
    id,
    type,
    timestamp: new Date().toISOString(),
    nodeId,
    payload,
  };
}

describe("session-replay", () => {
  // Clear cache before each test to ensure isolation
  beforeEach(() => {
    clearReplayCache();
  });

  describe("replayUpToIndex", () => {
    it("should return empty state for empty interactions", () => {
      const result = replayUpToIndex([], 0);

      expect(result.messages).toHaveLength(0);
      expect(result.currentNodeId).toBe("");
      expect(result.currentInteractionIndex).toBe(-1);
    });

    it("should return empty state for negative index", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.message", "node-1", { content: "Hello" }),
      ];

      const result = replayUpToIndex(interactions, -1);

      expect(result.messages).toHaveLength(0);
      expect(result.currentNodeId).toBe("");
      expect(result.currentInteractionIndex).toBe(-1);
    });

    it("should process user.message interactions", () => {
      const interactions = [
        createMockInteraction("evt-1", "user.message", "node-1", { text: "Hello" }),
      ];

      const result = replayUpToIndex(interactions, 0);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].from).toBe("user");
      expect(result.messages[0].message.content).toBe("Hello");
    });

    it("should process engine.message interactions", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.message", "node-1", { content: "Bot response" }),
      ];

      const result = replayUpToIndex(interactions, 0);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].from).toBe("bot");
      expect(result.messages[0].message.content).toBe("Bot response");
    });

    it("should skip engine.transition interactions (no message)", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.transition", "node-1", { to: "node-2" }),
      ];

      const result = replayUpToIndex(interactions, 0);

      expect(result.messages).toHaveLength(0);
      expect(result.currentNodeId).toBe("node-2");
    });

    it("should track current node position through transitions", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.message", "node-1", { content: "First" }),
        createMockInteraction("evt-2", "engine.transition", "node-1", { to: "node-2" }),
        createMockInteraction("evt-3", "engine.message", "node-2", { content: "Second" }),
        createMockInteraction("evt-4", "engine.transition", "node-2", { to: "node-3" }),
      ];

      const result = replayUpToIndex(interactions, 3);

      expect(result.currentNodeId).toBe("node-3");
      expect(result.messages).toHaveLength(2);
    });

    describe("incremental caching", () => {
      it("should use cache for same index (CASE 1)", () => {
        const interactions = [
          createMockInteraction("evt-1", "engine.message", "node-1", { content: "Hello" }),
          createMockInteraction("evt-2", "user.message", "node-1", { text: "Hi" }),
        ];

        // First call - cache miss
        const result1 = replayUpToIndex(interactions, 1);

        // Second call - same index, should use cache
        const result2 = replayUpToIndex(interactions, 1);

        // Results should be identical
        expect(result2.messages).toHaveLength(2);
        expect(result2.currentNodeId).toBe(result1.currentNodeId);
        expect(result2.currentInteractionIndex).toBe(result1.currentInteractionIndex);
      });

      it("should process only new interactions for forward seeking (CASE 2)", () => {
        const interactions = [
          createMockInteraction("evt-1", "engine.message", "node-1", { content: "First" }),
          createMockInteraction("evt-2", "engine.message", "node-1", { content: "Second" }),
          createMockInteraction("evt-3", "engine.message", "node-1", { content: "Third" }),
        ];

        // First call - process index 0
        const result1 = replayUpToIndex(interactions, 0);
        expect(result1.messages).toHaveLength(1);
        expect(result1.messages[0].message.content).toBe("First");

        // Forward to index 2 - should incrementally add messages
        const result2 = replayUpToIndex(interactions, 2);
        expect(result2.messages).toHaveLength(3);
        expect(result2.messages[0].message.content).toBe("First");
        expect(result2.messages[2].message.content).toBe("Third");
      });

      it("should slice messages for backward seeking (CASE 3)", () => {
        const interactions = [
          createMockInteraction("evt-1", "engine.message", "node-1", { content: "First" }),
          createMockInteraction("evt-2", "engine.message", "node-1", { content: "Second" }),
          createMockInteraction("evt-3", "engine.message", "node-1", { content: "Third" }),
        ];

        // First, build cache by going forward
        replayUpToIndex(interactions, 2);

        // Then seek backward
        const result = replayUpToIndex(interactions, 0);

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].message.content).toBe("First");
        expect(result.currentInteractionIndex).toBe(0);
      });

      it("should handle forward then backward then forward seeking", () => {
        const interactions = [
          createMockInteraction("evt-1", "engine.message", "node-1", { content: "First" }),
          createMockInteraction("evt-2", "engine.message", "node-1", { content: "Second" }),
          createMockInteraction("evt-3", "engine.message", "node-1", { content: "Third" }),
          createMockInteraction("evt-4", "engine.message", "node-1", { content: "Fourth" }),
        ];

        // Forward to index 3
        const r1 = replayUpToIndex(interactions, 3);
        expect(r1.messages).toHaveLength(4);

        // Backward to index 1
        const r2 = replayUpToIndex(interactions, 1);
        expect(r2.messages).toHaveLength(2);

        // Forward to index 2
        const r3 = replayUpToIndex(interactions, 2);
        expect(r3.messages).toHaveLength(3);
      });

      it("should invalidate cache when interactions array changes", () => {
        const interactions1 = [
          createMockInteraction("evt-1", "engine.message", "node-1", { content: "First" }),
        ];

        const interactions2 = [
          createMockInteraction("evt-1", "engine.message", "node-1", { content: "Different" }),
        ];

        // Build cache with first array
        replayUpToIndex(interactions1, 0);

        // Use different array - should rebuild cache
        const result = replayUpToIndex(interactions2, 0);

        expect(result.messages[0].message.content).toBe("Different");
      });
    });

    describe("node position tracking", () => {
      it("should correctly track node position through complex sequence", () => {
        const interactions = [
          createMockInteraction("evt-1", "engine.message", "node-start", { content: "Start" }),
          createMockInteraction("evt-2", "engine.transition", "node-start", { to: "node-a" }),
          createMockInteraction("evt-3", "engine.message", "node-a", { content: "In A" }),
          createMockInteraction("evt-4", "engine.transition", "node-a", { to: "node-b" }),
          createMockInteraction("evt-5", "engine.message", "node-b", { content: "In B" }),
        ];

        // Check position at each step
        expect(replayUpToIndex(interactions, 0).currentNodeId).toBe("node-start");
        expect(replayUpToIndex(interactions, 1).currentNodeId).toBe("node-a");
        expect(replayUpToIndex(interactions, 2).currentNodeId).toBe("node-a");
        expect(replayUpToIndex(interactions, 3).currentNodeId).toBe("node-b");
        expect(replayUpToIndex(interactions, 4).currentNodeId).toBe("node-b");
      });
    });
  });

  describe("button label lookup", () => {
    it("should lookup button labels from nodes", () => {
      const interactions = [
        createMockInteraction("evt-1", "user.click", "node-1", { buttonId: "btn-1" }),
      ];

      const nodes: NodeWithButtons[] = [
        {
          id: "node-1",
          data: {
            buttons: [
              { id: "btn-1", text: "Click Me" },
            ],
          },
        },
      ];

      const result = replayUpToIndex(interactions, 0, nodes);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].message.content).toBe("__ACTION__Click Me");
    });

    it("should use buttonLabel from payload when available", () => {
      const interactions = [
        createMockInteraction("evt-1", "user.click", "node-1", {
          buttonId: "btn-1",
          buttonLabel: "Custom Label",
        }),
      ];

      const nodes: NodeWithButtons[] = [
        {
          id: "node-1",
          data: {
            buttons: [
              { id: "btn-1", text: "Default Text" },
            ],
          },
        },
      ];

      const result = replayUpToIndex(interactions, 0, nodes);

      // Should prefer payload.buttonLabel over node lookup
      expect(result.messages[0].message.content).toBe("__ACTION__Custom Label");
    });

    it("should fallback to buttonId when no label found", () => {
      const interactions = [
        createMockInteraction("evt-1", "user.click", "node-1", { buttonId: "unknown-btn" }),
      ];

      const result = replayUpToIndex(interactions, 0);

      expect(result.messages[0].message.content).toBe("__ACTION__unknown-btn");
    });
  });

  describe("getAllMessages", () => {
    it("should return all messages from interactions", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.message", "node-1", { content: "First" }),
        createMockInteraction("evt-2", "engine.transition", "node-1", { to: "node-2" }),
        createMockInteraction("evt-3", "user.message", "node-2", { text: "Reply" }),
      ];

      const messages = getAllMessages(interactions);

      expect(messages).toHaveLength(2); // transition doesn't produce message
      expect(messages[0].message.content).toBe("First");
      expect(messages[1].message.content).toBe("Reply");
    });

    it("should return empty array for empty interactions", () => {
      expect(getAllMessages([])).toHaveLength(0);
    });
  });

  describe("getInteractionAt", () => {
    it("should return interaction at valid index", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.message", "node-1", { content: "Hello" }),
        createMockInteraction("evt-2", "user.message", "node-1", { text: "Hi" }),
      ];

      const result = getInteractionAt(interactions, 1);

      expect(result).not.toBeNull();
      expect(result?.id).toBe("evt-2");
    });

    it("should return null for negative index", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.message", "node-1", { content: "Hello" }),
      ];

      expect(getInteractionAt(interactions, -1)).toBeNull();
    });

    it("should return null for out-of-bounds index", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.message", "node-1", { content: "Hello" }),
      ];

      expect(getInteractionAt(interactions, 5)).toBeNull();
    });
  });

  describe("getNodeAtIndex", () => {
    it("should return node position at specific index", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.message", "node-1", { content: "First" }),
        createMockInteraction("evt-2", "engine.transition", "node-1", { to: "node-2" }),
        createMockInteraction("evt-3", "engine.message", "node-2", { content: "Second" }),
      ];

      expect(getNodeAtIndex(interactions, 0)).toBe("node-1");
      expect(getNodeAtIndex(interactions, 1)).toBe("node-2");
      expect(getNodeAtIndex(interactions, 2)).toBe("node-2");
    });

    it("should return empty string for empty interactions", () => {
      expect(getNodeAtIndex([], 0)).toBe("");
    });
  });

  describe("clearReplayCache", () => {
    it("should clear the cache and force recomputation", () => {
      const interactions = [
        createMockInteraction("evt-1", "engine.message", "node-1", { content: "Hello" }),
      ];

      // Build cache
      replayUpToIndex(interactions, 0);

      // Clear cache
      clearReplayCache();

      // This should trigger full recomputation (CASE 4)
      const result = replayUpToIndex(interactions, 0);

      expect(result.messages).toHaveLength(1);
    });
  });
});
