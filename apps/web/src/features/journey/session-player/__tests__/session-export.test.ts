/**
 * Session Export Tests
 *
 * Validates:
 * 1. SessionExportSchema compliance
 * 2. Required fields presence
 * 3. Optional fields handling
 * 4. Both export paths (file download and impersonate)
 * 5. Journey definition inclusion
 * 6. Data consistency between paths
 */

import { describe, it, expect } from "vitest";
import { SessionExportSchema, type SessionExport } from "@journey/schemas";
import { z } from "zod";

describe("Session Export Validation", () => {
  // =========================================================================
  // FIXTURE: Sample Export Data
  // =========================================================================

  // Helper to generate valid UUIDs for testing
  const generateUUID = (): string => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const createSampleExport = (overrides: Partial<SessionExport> = {}): SessionExport => {
    const journeyId = "a1b2c3d4-e5f6-4a7b-8c9d-ae1f2a3b4c5d";
    const sessionId = generateUUID();

    return {
    exportVersion: "1.0",
    exportedAt: new Date().toISOString(),
    journey: {
      id: journeyId,
      slug: "saas-onboarding",
      name: "SaaS Onboarding Demo",
    },
    user: {
      id: generateUUID(),
      platformUserId: "telegram:987654321",
      displayName: "John Doe",
      firstName: "John",
      lastName: "Doe",
      username: "johndoe",
    },
    session: {
      id: sessionId,
      status: "active",
      currentNodeId: "node-1",
      context: {
        userTier: "basic",
        trialDaysLeft: 14,
      },
      tags: ["trial-user", "new-signup", "engaged"],
      nodeOutputs: {
        "welcome-message": {
          nodeId: "start",
          nodeLabel: "Welcome",
          nodeType: "message",
          executedAt: new Date().toISOString(),
          data: {
            message: "Welcome!",
            delivered: true,
          },
        },
      },
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
    hasStarted: false,
    },
    interactions: [
      {
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        type: "engine.transition",
        nodeId: "start",
        payload: {
          from: null,
          to: "node-1",
        },
        metadata: {
          source: "journey",
        },
      },
    ],
    ...overrides,
  };
};

  // =========================================================================
  // TEST SUITE 1: Required Fields
  // =========================================================================

  describe("Required Fields", () => {
    it("should validate export with all required fields", () => {
      const validExport = createSampleExport();
      const result = SessionExportSchema.safeParse(validExport);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exportVersion).toBe("1.0");
        expect(result.data.user.id).toBeDefined();
        expect(result.data.user.platformUserId).toBeDefined();
      }
    });

    it("should reject export missing user.id", () => {
      const invalidExport = createSampleExport({
        user: {
          ...createSampleExport().user,
          id: "",
        },
      });

      const result = SessionExportSchema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });

    it("should reject export missing user.platformUserId", () => {
      const invalidExport = createSampleExport({
        user: {
          ...createSampleExport().user,
          platformUserId: "",
        },
      });

      const result = SessionExportSchema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });

    it("should reject export missing user.displayName", () => {
      const invalidExport = createSampleExport({
        user: {
          ...createSampleExport().user,
          displayName: "",
        },
      });

      const result = SessionExportSchema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });

    it("should require session.id to be valid UUID", () => {
      const invalidExport = createSampleExport({
        session: {
          ...createSampleExport().session,
          id: "not-a-uuid",
        },
      });

      const result = SessionExportSchema.safeParse(invalidExport);
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // TEST SUITE 2: Optional Fields
  // =========================================================================

  describe("Optional Fields", () => {
    it("should accept export without journey definition", () => {
      const minimalExport = createSampleExport();
      delete (minimalExport as any).journeyDefinition;

      const result = SessionExportSchema.safeParse(minimalExport);
      expect(result.success).toBe(true);
    });

    it("should accept export without platform messages", () => {
      const minimalExport = createSampleExport();
      delete (minimalExport as any).platformMessages;

      const result = SessionExportSchema.safeParse(minimalExport);
      expect(result.success).toBe(true);
    });

    it("should accept export without session context", () => {
      const minimalExport = createSampleExport();
      delete (minimalExport as any).sessionContext;

      const result = SessionExportSchema.safeParse(minimalExport);
      expect(result.success).toBe(true);
    });

    it("should accept null user fields (firstName, lastName, username)", () => {
      const exportWithNulls = createSampleExport({
        user: {
          ...createSampleExport().user,
          firstName: null,
          lastName: null,
          username: null,
        },
      });

      const result = SessionExportSchema.safeParse(exportWithNulls);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.firstName).toBeNull();
        expect(result.data.user.lastName).toBeNull();
        expect(result.data.user.username).toBeNull();
      }
    });
  });

  // =========================================================================
  // TEST SUITE 3: Journey Definition
  // =========================================================================

  describe("Journey Definition", () => {
    it("should accept export without journey definition", () => {
      // Journey definition is optional, so this should pass
      const exportWithoutJourney = createSampleExport();

      const result = SessionExportSchema.safeParse(exportWithoutJourney);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.journeyDefinition).toBeUndefined();
      }
    });

    it("should accept export with empty journey definition", () => {
      // Journey definition with empty nodes and edges should be valid
      const exportWithJourney = createSampleExport({
        journeyDefinition: {
          nodes: [],
          edges: [],
        },
      });

      const result = SessionExportSchema.safeParse(exportWithJourney);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.journeyDefinition).toBeDefined();
        expect(result.data.journeyDefinition?.nodes.length).toBe(0);
      }
    });
  });

  // =========================================================================
  // TEST SUITE 4: Platform Message Correlation
  // =========================================================================

  describe("Platform Message Correlation", () => {
    it("should accept export with platform messages", () => {
      const exportWithMessages = createSampleExport({
        platformMessages: [
          {
            interactionEventId: generateUUID(),
            platformMessageId: "123456789",
            platformChatId: "9876543210",
            messageType: "text",
            sentAt: new Date().toISOString(),
          },
        ],
      });

      const result = SessionExportSchema.safeParse(exportWithMessages);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.platformMessages).toBeDefined();
        expect(result.data.platformMessages?.length).toBe(1);
      }
    });

    it("should validate platform message fields", () => {
      const exportWithMessages = createSampleExport({
        platformMessages: [
          {
            interactionEventId: generateUUID(),
            platformMessageId: "msg-123",
            platformChatId: "chat-456",
            messageType: "text",
            sentAt: new Date().toISOString(),
          },
          {
            interactionEventId: generateUUID(),
            platformMessageId: "msg-789",
            platformChatId: "chat-456",
            messageType: "buttons",
            sentAt: new Date().toISOString(),
          },
        ],
      });

      const result = SessionExportSchema.safeParse(exportWithMessages);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.platformMessages?.length).toBe(2);
      }
    });
  });

  // =========================================================================
  // TEST SUITE 5: Session Context
  // =========================================================================

  describe("Session Context", () => {
    it("should accept export with session context", () => {
      const exportWithContext = createSampleExport({
        sessionContext: {
          organizationId: generateUUID(),
          channelId: generateUUID(),
          mode: "live",
          platform: "telegram",
          channelName: "Main Bot",
        },
      });

      const result = SessionExportSchema.safeParse(exportWithContext);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionContext).toBeDefined();
        expect(result.data.sessionContext?.mode).toBe("live");
      }
    });

    it("should validate mode enum", () => {
      const modes: Array<"live" | "test" | "simulation"> = ["live", "test", "simulation"];

      modes.forEach((mode) => {
        const exportWithMode = createSampleExport({
          sessionContext: {
            organizationId: generateUUID(),
            channelId: generateUUID(),
            mode,
            platform: "telegram",
          },
        });

        const result = SessionExportSchema.safeParse(exportWithMode);
        expect(result.success).toBe(true);
      });
    });

    it("should accept null platform in session context", () => {
      const exportWithContext = createSampleExport({
        sessionContext: {
          organizationId: generateUUID(),
          channelId: null,
          mode: "simulation",
          platform: null,
        },
      });

      const result = SessionExportSchema.safeParse(exportWithContext);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // TEST SUITE 6: Data Consistency & Round-trip
  // =========================================================================

  describe("Data Consistency", () => {
    it("should serialize and deserialize without data loss", () => {
      const original = createSampleExport({
        platformMessages: [
          {
            interactionEventId: generateUUID(),
            platformMessageId: "msg-123",
            platformChatId: "chat-456",
            messageType: "text",
            sentAt: new Date().toISOString(),
          },
        ],
        sessionContext: {
          organizationId: generateUUID(),
          channelId: generateUUID(),
          mode: "live",
          platform: "telegram",
        },
      });

      // Serialize to JSON
      const json = JSON.stringify(original);

      // Deserialize
      const deserialized = JSON.parse(json);

      // Validate
      const result = SessionExportSchema.safeParse(deserialized);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.user.id).toBe(original.user.id);
        expect(result.data.session.id).toBe(original.session.id);
        expect(result.data.journeyDefinition?.nodes.length).toBe(
          original.journeyDefinition?.nodes.length
        );
        expect(result.data.platformMessages?.length).toBe(
          original.platformMessages?.length
        );
        expect(result.data.sessionContext?.mode).toBe(original.sessionContext?.mode);
      }
    });

    it("should preserve complex context data", () => {
      const complexContext = {
        userTier: "premium",
        features: ["ai-agent", "webhooks", "api-access"],
        metadata: {
          source: "referral",
          referrerId: "user-456",
        },
        nestedData: {
          level1: {
            level2: {
              value: "deep",
            },
          },
        },
      };

      const exportWithComplexContext = createSampleExport({
        session: {
          ...createSampleExport().session,
          context: complexContext,
        },
      });

      const result = SessionExportSchema.safeParse(exportWithComplexContext);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.session.context.userTier).toBe("premium");
        expect(Array.isArray(result.data.session.context.features)).toBe(true);
        expect(result.data.session.context.metadata).toBeDefined();
      }
    });
  });

  // =========================================================================
  // TEST SUITE 7: Edge Cases
  // =========================================================================

  describe("Edge Cases", () => {
    it("should handle empty interactions array", () => {
      const exportWithEmptyInteractions = createSampleExport({
        interactions: [],
      });

      const result = SessionExportSchema.safeParse(exportWithEmptyInteractions);
      expect(result.success).toBe(true);
    });

    it("should handle session with null completedAt", () => {
      const exportWithNullCompletedAt = createSampleExport({
        session: {
          ...createSampleExport().session,
          completedAt: null,
    hasStarted: false,
          status: "active",
        },
      });

      const result = SessionExportSchema.safeParse(exportWithNullCompletedAt);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.session.completedAt).toBeNull();
      }
    });

    it("should validate all session statuses", () => {
      const statuses: Array<"active" | "completed" | "dropped" | "paused" | "error"> = [
        "active",
        "completed",
        "dropped",
        "paused",
        "error",
      ];

      statuses.forEach((status) => {
        const exportWithStatus = createSampleExport({
          session: {
            ...createSampleExport().session,
            status,
          },
        });

        const result = SessionExportSchema.safeParse(exportWithStatus);
        expect(result.success).toBe(true);
      });
    });

    it("should handle very large node outputs", () => {
      const largeNodeOutputs: Record<string, any> = {};

      for (let i = 0; i < 100; i++) {
        largeNodeOutputs[`node-${i}`] = {
          nodeId: `node-${i}`,
          nodeLabel: `Node ${i}`,
          nodeType: "message",
          executedAt: new Date().toISOString(),
          data: {
            responses: Array.from({ length: 10 }, (_, j) => `response-${j}`),
            metadata: { index: i, timestamp: Date.now() },
          },
        };
      }

      const exportWithManyOutputs = createSampleExport({
        session: {
          ...createSampleExport().session,
          nodeOutputs: largeNodeOutputs,
        },
      });

      const result = SessionExportSchema.safeParse(exportWithManyOutputs);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // TEST SUITE 8: Backward Compatibility
  // =========================================================================

  describe("Backward Compatibility", () => {
    it("should accept old exports without new optional fields", () => {
      // Simulate an export from before journeyDefinition was added
      const oldFormatExport: any = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        journey: {
          id: generateUUID(),
          slug: "old-journey",
          name: "Old Journey",
        },
        user: {
          id: generateUUID(),
          platformUserId: "telegram:123",
          displayName: "User",
          firstName: null,
          lastName: null,
          username: null,
        },
        session: createSampleExport().session,
        interactions: createSampleExport().interactions,
      };

      const result = SessionExportSchema.safeParse(oldFormatExport);
      expect(result.success).toBe(true);
    });

    it("should accept exports with only some optional fields", () => {
      const partialOptionalFields = createSampleExport({
        journeyDefinition: {
          nodes: [],
          edges: [],
        },
        // No platformMessages
        // No sessionContext
      });

      const result = SessionExportSchema.safeParse(partialOptionalFields);
      expect(result.success).toBe(true);
    });
  });
});
