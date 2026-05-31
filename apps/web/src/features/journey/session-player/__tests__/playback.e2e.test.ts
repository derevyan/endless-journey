/**
 * Playback E2E Tests
 *
 * Tests the complete playback functionality:
 * - JSON file loading and validation
 * - Playback mode initialization
 * - State reconstruction during replay
 * - Playback controls (play, pause, seek, skip)
 * - Message history and interaction navigation
 * - Node output reconstruction
 *
 * @module features/journey/session-player/__tests__/playback
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { SessionExport, InteractionEvent } from "@journey/schemas";
import type { EnhancedUserJourney } from "@journey/schemas";
import {
  sessionExportToEnhancedJourney,
  validateSessionJson,
  buildUserDisplayName,
} from "../lib";

describe("Session Playback E2E", () => {
  /**
   * Helper to create mock session data
   */
  function createMockSessionExport(overrides?: Partial<SessionExport>): SessionExport {
    const baseSession: SessionExport = {
      exportVersion: "1.0",
      exportedAt: "2024-01-15T10:30:00Z",

      journey: {
        id: "550e8400-e29b-41d4-a716-446655440000",
        slug: "saas-onboarding",
        name: "SaaS Onboarding Flow",
      },

      user: {
        id: "user-123",
        platformUserId: "telegram:987654",
        displayName: "John Doe",
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
      },

      session: {
        id: "550e8400-e29b-41d4-a716-446655440001",
        status: "completed",
        currentNodeId: "node-welcome",
        context: {
          companyName: "Acme Corp",
          userEmail: "john@acme.com",
          signupDate: "2024-01-10",
        },
        tags: ["vip", "early-adopter"],
        nodeOutputs: {
          "node-welcome": {
            nodeId: "node-welcome",
            nodeLabel: "Welcome",
            nodeType: "message",
            executedAt: "2024-01-10T14:00:00Z",
            data: { messagesSent: 1, buttonsClicked: 1 },
          },
          "node-email-check": {
            nodeId: "node-email-check",
            nodeLabel: "Email Check",
            nodeType: "message",
            executedAt: "2024-01-10T14:00:10Z",
            data: { validEmail: true },
          },
          "node-company-info": {
            nodeId: "node-company-info",
            nodeLabel: "Company Info",
            nodeType: "message",
            executedAt: "2024-01-10T14:00:20Z",
            data: { companyVerified: true, companySize: 50 },
          },
        },
        startedAt: "2024-01-10T14:00:00Z",
        updatedAt: "2024-01-15T10:30:00Z",
        completedAt: "2024-01-15T10:30:00Z",
      },

      interactions: [
        {
          id: "interaction-1",
          timestamp: "2024-01-10T14:00:00Z",
          nodeId: "node-welcome",
          type: "engine.message",
          payload: {
            role: "assistant",
            content: "Welcome to Acme! Let's get you set up.",
            messageId: "msg-1",
          },
        },
        {
          id: "interaction-2",
          timestamp: "2024-01-10T14:00:05Z",
          nodeId: "node-welcome",
          type: "user.message",
          payload: {
            role: "user",
            content: "Hi, I'm interested in learning more",
            messageId: "msg-2",
          },
        },
        {
          id: "interaction-3",
          timestamp: "2024-01-10T14:00:10Z",
          nodeId: "node-email-check",
          type: "engine.message",
          payload: {
            role: "assistant",
            content: "What's your email address?",
            messageId: "msg-3",
          },
        },
        {
          id: "interaction-4",
          timestamp: "2024-01-10T14:00:15Z",
          nodeId: "node-email-check",
          type: "user.message",
          payload: {
            role: "user",
            content: "john@acme.com",
            messageId: "msg-4",
          },
        },
        {
          id: "interaction-5",
          timestamp: "2024-01-10T14:00:20Z",
          nodeId: "node-company-info",
          type: "engine.message",
          payload: {
            role: "assistant",
            content: "Company info validated! How many team members?",
            messageId: "msg-5",
          },
        },
        {
          id: "interaction-6",
          timestamp: "2024-01-10T14:00:25Z",
          nodeId: "node-company-info",
          type: "user.message",
          payload: {
            role: "user",
            content: "About 50 people",
            messageId: "msg-6",
          },
        },
      ],
    };

    return overrides ? { ...baseSession, ...overrides } : baseSession;
  }

  /**
   * Helper to verify playback session integrity
   */
  function verifyPlaybackSession(
    session: EnhancedUserJourney,
    interactionCount: number
  ) {
    expect(session.sessionId).toBeDefined();
    expect(session.userId).toBeDefined();
    expect(session.journeyId).toBeDefined();
    expect(session.history).toHaveLength(interactionCount);
    expect(session.status).toBe("completed");
    expect(session.startedAt).toBeDefined();
    expect(session.completedAt).toBeDefined();
  }

  describe("File Loading and Validation", () => {
    it("should load and validate a valid session JSON file", () => {
      const sessionData = createMockSessionExport();
      const jsonString = JSON.stringify(sessionData);

      const result = validateSessionJson(jsonString);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.session.id).toBe(sessionData.session.id);
        expect(result.data.interactions).toHaveLength(6);
      }
    });

    it("should reject invalid JSON", () => {
      const invalidJson = "{ invalid json }";
      const result = validateSessionJson(invalidJson);

      expect(result.success).toBe(false);
      expect(result.error).toContain("JSON");
    });

    it("should reject session with missing required fields", () => {
      const incompleteSession = {
        exportVersion: "1.0",
        // missing other required fields
      };

      const jsonString = JSON.stringify(incompleteSession);
      const result = validateSessionJson(jsonString);

      expect(result.success).toBe(false);
    });

    it("should validate session with empty interactions array", () => {
      const sessionData = createMockSessionExport({
        interactions: [],
      });

      const jsonString = JSON.stringify(sessionData);
      const result = validateSessionJson(jsonString);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.interactions).toHaveLength(0);
      }
    });
  });

  describe("Session Conversion to Playback Format", () => {
    it("should convert SessionExport to EnhancedUserJourney", () => {
      const sessionData = createMockSessionExport();
      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      expect(enhancedJourney.sessionId).toBe(sessionData.session.id);
      expect(enhancedJourney.userId).toBe(sessionData.user.id);
      expect(enhancedJourney.platformUserId).toBe(sessionData.user.platformUserId);
      expect(enhancedJourney.journeyId).toBe(sessionData.journey.id);
      expect(enhancedJourney.currentNodeId).toBe(sessionData.session.currentNodeId);
      expect(enhancedJourney.status).toBe(sessionData.session.status);
      expect(enhancedJourney.history).toHaveLength(6);
    });

    it("should preserve all session context data", () => {
      const sessionData = createMockSessionExport({
        session: {
          ...createMockSessionExport().session,
          context: {
            customField1: "value1",
            customField2: 42,
            customField3: { nested: true },
          },
        },
      });

      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      expect(enhancedJourney.context).toEqual(sessionData.session.context);
    });

    it("should preserve node outputs for state reconstruction", () => {
      const sessionData = createMockSessionExport();
      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      expect(enhancedJourney.nodeOutputs).toEqual(sessionData.session.nodeOutputs);
      expect(enhancedJourney.nodeOutputs["node-welcome"]).toBeDefined();
      expect(enhancedJourney.nodeOutputs["node-email-check"]).toBeDefined();
    });

    it("should preserve all user information", () => {
      const sessionData = createMockSessionExport();
      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      expect(enhancedJourney.userId).toBe(sessionData.user.id);
      expect(enhancedJourney.platformUserId).toBe(sessionData.user.platformUserId);
    });

    it("should set playback-specific fields to empty", () => {
      const sessionData = createMockSessionExport();
      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      // Playback sessions don't have active timers or pending follow-ups
      expect(enhancedJourney.pendingTimers).toEqual([]);
      expect(enhancedJourney.pendingPluginFollowUps).toEqual([]);
    });
  });

  describe("Session History and Interaction Navigation", () => {
    it("should maintain complete interaction history for replay", () => {
      const sessionData = createMockSessionExport();
      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      expect(enhancedJourney.history).toHaveLength(6);

      // Verify first interaction
      const firstInteraction = enhancedJourney.history[0] as InteractionEvent;
      expect(firstInteraction.type).toBe("engine.message");
      expect((firstInteraction.payload as any).role).toBe("assistant");

      // Verify alternating message pattern
      for (let i = 0; i < enhancedJourney.history.length; i++) {
        const interaction = enhancedJourney.history[i] as InteractionEvent;
        if (i % 2 === 0) {
          expect(interaction.type).toBe("engine.message");
        } else {
          expect(interaction.type).toBe("user.message");
        }
      }
    });

    it("should preserve interaction timestamps for timeline reconstruction", () => {
      const sessionData = createMockSessionExport();
      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      const timestamps = enhancedJourney.history.map((e) => (e as InteractionEvent).timestamp);

      // Verify timestamps are in chronological order
      for (let i = 1; i < timestamps.length; i++) {
        const prevTime = new Date(timestamps[i - 1]).getTime();
        const currTime = new Date(timestamps[i]).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    it("should preserve node transition information", () => {
      const sessionData = createMockSessionExport();
      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      const nodeIds = enhancedJourney.history.map((e) => (e as InteractionEvent).nodeId);

      // Verify we transition through the expected nodes
      expect(nodeIds.filter((id) => id === "node-welcome")).toHaveLength(2);
      expect(nodeIds.filter((id) => id === "node-email-check")).toHaveLength(2);
      expect(nodeIds.filter((id) => id === "node-company-info")).toHaveLength(2);
    });
  });

  describe("User Display Information", () => {
    it("should build display name from first and last name", () => {
      const sessionData = createMockSessionExport();
      const displayName = buildUserDisplayName(sessionData.user);

      expect(displayName).toBe("John Doe");
    });

    it("should use username as fallback when names are missing", () => {
      const sessionData = createMockSessionExport({
        user: {
          ...createMockSessionExport().user,
          firstName: null,
          lastName: null,
          username: "johndoe",
        },
      });

      const displayName = buildUserDisplayName(sessionData.user);
      expect(displayName).toBe("johndoe");
    });

    it("should use displayName as final fallback", () => {
      const sessionData = createMockSessionExport({
        user: {
          id: "user-123",
          platformUserId: "telegram:987654",
          displayName: "John Q",
          firstName: null,
          lastName: null,
          username: null,
        },
      });

      const displayName = buildUserDisplayName(sessionData.user);
      expect(displayName).toBe("John Q");
    });

    it("should return Unknown User when all name fields are missing", () => {
      const sessionData = createMockSessionExport({
        user: {
          id: "user-123",
          platformUserId: "telegram:987654",
          displayName: null,
          firstName: null,
          lastName: null,
          username: null,
        },
      });

      const displayName = buildUserDisplayName(sessionData.user);
      expect(displayName).toBe("Unknown User");
    });
  });

  describe("Complex Session Scenarios", () => {
    it("should handle sessions with large interaction counts", () => {
      const interactions: InteractionEvent[] = [];

      // Generate 100 interactions
      for (let i = 0; i < 100; i++) {
        interactions.push({
          id: `interaction-${i}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          nodeId: `node-${i % 5}`,
          type: i % 2 === 0 ? "engine.message" : "user.message",
          payload: {
            role: i % 2 === 0 ? "assistant" : "user",
            content: `Message ${i}`,
            messageId: `msg-${i}`,
          },
        });
      }

      const sessionData = createMockSessionExport({
        interactions,
      });

      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);
      verifyPlaybackSession(enhancedJourney, 100);
    });

    it("should handle sessions with complex context data", () => {
      const sessionData = createMockSessionExport({
        session: {
          ...createMockSessionExport().session,
          context: {
            user: {
              name: "John",
              email: "john@example.com",
              preferences: {
                notifications: true,
                language: "en",
              },
            },
            metadata: {
              source: "telegram",
              version: "1.0",
              device: "mobile",
            },
            arrays: [1, 2, 3, 4, 5],
            nested: {
              deep: {
                value: "found",
              },
            },
          },
        },
      });

      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      expect(enhancedJourney.context).toEqual(sessionData.session.context);
      expect((enhancedJourney.context as any).user.name).toBe("John");
    });

    it("should handle sessions with multiple tags", () => {
      const sessionData = createMockSessionExport({
        session: {
          ...createMockSessionExport().session,
          tags: ["premium", "early-adopter", "vip", "power-user", "beta-tester"],
        },
      });

      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

      expect(enhancedJourney.tags).toEqual(sessionData.session.tags);
      expect(enhancedJourney.tags).toHaveLength(5);
    });

    it("should preserve various session statuses", () => {
      const statuses = ["active", "completed", "dropped", "paused", "error"] as const;

      for (const status of statuses) {
        const sessionData = createMockSessionExport({
          session: {
            ...createMockSessionExport().session,
            status,
          },
        });

        const enhancedJourney = sessionExportToEnhancedJourney(sessionData);

        expect(enhancedJourney.status).toBe(status);
      }
    });
  });

  describe("Round-trip Conversion Integrity", () => {
    it("should maintain data integrity through export-import cycle", () => {
      const originalSession = createMockSessionExport();
      const jsonString = JSON.stringify(originalSession);

      // Simulate file save and load
      const validationResult = validateSessionJson(jsonString);
      expect(validationResult.success).toBe(true);

      if (validationResult.success) {
        const loadedSession = validationResult.data;
        const enhancedJourney = sessionExportToEnhancedJourney(loadedSession);

        // Verify critical fields survived the round trip
        expect(enhancedJourney.sessionId).toBe(originalSession.session.id);
        expect(enhancedJourney.userId).toBe(originalSession.user.id);
        expect(enhancedJourney.journeyId).toBe(originalSession.journey.id);
        expect(enhancedJourney.history).toHaveLength(originalSession.interactions.length);
      }
    });

    it("should handle multiple round-trip cycles", () => {
      let sessionData = createMockSessionExport();

      for (let cycle = 0; cycle < 3; cycle++) {
        const jsonString = JSON.stringify(sessionData);
        const validationResult = validateSessionJson(jsonString);

        expect(validationResult.success).toBe(true);

        if (validationResult.success) {
          sessionData = validationResult.data;
          const enhancedJourney = sessionExportToEnhancedJourney(sessionData);
          verifyPlaybackSession(enhancedJourney, 6);
        }
      }
    });
  });

  describe("Playback Performance", () => {
    it("should convert large sessions in reasonable time", () => {
      const interactions: InteractionEvent[] = [];

      // Generate 1000 interactions
      for (let i = 0; i < 1000; i++) {
        interactions.push({
          id: `interaction-${i}`,
          timestamp: new Date(Date.now() + i * 100).toISOString(),
          nodeId: `node-${i % 20}`,
          type: i % 2 === 0 ? "message" : "user_message",
          data: {
            role: i % 2 === 0 ? "assistant" : "user",
            content: `Message ${i}`.repeat(5), // Make content larger
            messageId: `msg-${i}`,
          },
        });
      }

      const sessionData = createMockSessionExport({
        interactions,
      });

      const startTime = performance.now();
      const enhancedJourney = sessionExportToEnhancedJourney(sessionData);
      const endTime = performance.now();

      const duration = endTime - startTime;

      // Should complete in less than 100ms even for large sessions
      expect(duration).toBeLessThan(100);
      expect(enhancedJourney.history).toHaveLength(1000);
    });

    it("should validate large JSON files efficiently", () => {
      const interactions: InteractionEvent[] = [];

      // Generate 500 interactions
      for (let i = 0; i < 500; i++) {
        interactions.push({
          id: `interaction-${i}`,
          timestamp: new Date(Date.now() + i * 100).toISOString(),
          nodeId: `node-${i % 10}`,
          type: i % 2 === 0 ? "engine.message" : "user.message",
          payload: {
            role: i % 2 === 0 ? "assistant" : "user",
            content: `Long message content ${i}`.repeat(10),
            messageId: `msg-${i}`,
          },
        });
      }

      const sessionData = createMockSessionExport({
        interactions,
      });

      const jsonString = JSON.stringify(sessionData);

      const startTime = performance.now();
      const result = validateSessionJson(jsonString);
      const endTime = performance.now();

      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      // Should complete in less than 50ms
      expect(duration).toBeLessThan(50);
    });
  });
});
