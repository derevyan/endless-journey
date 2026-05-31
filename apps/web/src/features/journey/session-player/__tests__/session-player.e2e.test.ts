/**
 * Session Player E2E Tests
 *
 * Tests the complete flow of exporting and importing sessions as JSON files.
 * Tests the core validators, converters, and hooks for session replay functionality.
 *
 * @module features/journey/session-player/__tests__/session-player.e2e.test.ts
 */

import { describe, it, expect } from "vitest";
import { SessionExportSchema } from "@journey/schemas";
import {
  validateSessionJson,
  sanitizeFileName,
  getFileErrorMessage,
} from "../lib/session-file-validator";
import {
  sessionExportToEnhancedJourney,
  buildUserDisplayName,
} from "../lib/session-converters";

describe("Session Player E2E Tests", () => {
  describe("File Name Sanitization", () => {
    it("sanitizes special characters from filenames", () => {
      const input = "journey-@#$%^&*().json";
      const output = sanitizeFileName(input);

      expect(output).not.toContain("@");
      expect(output).not.toContain("#");
      expect(output).not.toContain("$");
      expect(output.length).toBeGreaterThan(0);
    });

    it("limits file name length to 100 characters", () => {
      const input = "a".repeat(200);
      const output = sanitizeFileName(input);

      expect(output.length).toBeLessThanOrEqual(100);
    });

    it("preserves alphanumeric characters and dashes", () => {
      const input = "my-journey-2024";
      const output = sanitizeFileName(input);

      expect(output).toContain("my");
      expect(output).toContain("journey");
      expect(output).toContain("2024");
    });

    it("handles unicode characters safely", () => {
      const input = "journey-emoji-🚀-test";
      const output = sanitizeFileName(input);

      expect(output.length).toBeGreaterThan(0);
      expect(() => encodeURIComponent(output)).not.toThrow();
    });
  });

  describe("User Display Name", () => {
    it("builds display name from displayName field", () => {
      const user = {
        displayName: "John Doe",
        firstName: "John",
        lastName: "Doe",
        username: "johndoe",
      };

      const name = buildUserDisplayName(user);
      expect(name).toBe("John Doe");
    });

    it("falls back to firstName + lastName if displayName is empty", () => {
      const user = {
        displayName: "",
        firstName: "Jane",
        lastName: "Smith",
        username: "janesmith",
      };

      const name = buildUserDisplayName(user);
      expect(name.length).toBeGreaterThan(0);
    });

    it("falls back to username if no name fields are present", () => {
      const user = {
        displayName: "",
        firstName: null,
        lastName: null,
        username: "unknown_user",
      };

      const name = buildUserDisplayName(user);
      expect(name).toBe("unknown_user");
    });

    it("uses generic fallback when all fields are empty", () => {
      const user = {
        displayName: "",
        firstName: null,
        lastName: null,
        username: null,
      };

      const name = buildUserDisplayName(user);
      expect(name.length).toBeGreaterThan(0);
    });
  });

  describe("File Validation", () => {
    it("rejects invalid JSON syntax with clear error message", () => {
      const invalidJson = "{ not valid json }";
      const result = validateSessionJson(invalidJson);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error.length).toBeGreaterThan(0);
    });

    it("rejects JSON with missing required journey fields", () => {
      const incomplete = JSON.stringify({
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        journey: { id: "test" }, // Missing slug and name
        user: { id: "test", platformUserId: "test", displayName: "Test" },
        session: {
          id: "test",
          status: "active",
          currentNodeId: "test",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
    hasStarted: false,
        },
        interactions: [],
      });

      const result = validateSessionJson(incomplete);
      expect(result.success).toBe(false);
    });

    it("rejects JSON with invalid session status enum", () => {
      const invalid = JSON.stringify({
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        journey: { id: "uuid-test", slug: "test", name: "Test" },
        user: { id: "test", platformUserId: "test", displayName: "Test" },
        session: {
          id: "uuid-test",
          status: "invalid-status", // Not in enum
          currentNodeId: "test",
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
    hasStarted: false,
        },
        interactions: [],
      });

      const result = validateSessionJson(invalid);
      expect(result.success).toBe(false);
    });

    it("provides friendly error messages for validation failures", () => {
      const invalid = JSON.stringify({
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        // Missing all required fields
      });

      const result = validateSessionJson(invalid);
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe("string");
    });
  });

  describe("Error Handling", () => {
    it("getFileErrorMessage handles parse errors gracefully", () => {
      const parseError = "Unexpected token } in JSON at position 42";
      const message = getFileErrorMessage(parseError);

      expect(message.length).toBeGreaterThan(0);
      expect(typeof message).toBe("string");
    });

    it("getFileErrorMessage handles schema validation errors", () => {
      const schemaError = "Property 'exportVersion' is required";
      const message = getFileErrorMessage(schemaError);

      expect(message.length).toBeGreaterThan(0);
      expect(typeof message).toBe("string");
    });

    it("handles corrupted JSON data", () => {
      const corrupted = "not valid json\\u0000\\u0000";
      const result = validateSessionJson(corrupted);

      expect(result.success).toBe(false);
    });
  });

  describe("Session Conversion", () => {
    it("converts valid SessionExport to EnhancedUserJourney format", () => {
      const sessionExport = {
        exportVersion: "1.0" as const,
        exportedAt: new Date().toISOString(),
        journey: {
          id: "journey-123",
          slug: "test-journey",
          name: "Test Journey",
        },
        user: {
          id: "user-456",
          platformUserId: "telegram:789",
          displayName: "John Doe",
          firstName: "John",
          lastName: "Doe",
          username: "johndoe",
        },
        session: {
          id: "session-abc",
          status: "active" as const,
          currentNodeId: "node-start",
          context: { userMessage: "Hello" },
          tags: ["test", "demo"],
          nodeOutputs: {},
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
    hasStarted: false,
        },
        interactions: [
          {
            type: "message" as const,
            role: "user" as const,
            content: "Hello",
            timestamp: new Date().toISOString(),
            nodeId: "node-start",
          },
        ],
      };

      const journey = sessionExportToEnhancedJourney(sessionExport);

      expect(journey.sessionId).toBe("session-abc");
      expect(journey.userId).toBe("user-456");
      expect(journey.journeyId).toBe("journey-123");
      expect(journey.currentNodeId).toBe("node-start");
      expect(journey.status).toBe("active");
      expect(journey.history.length).toBe(1);
    });

    it("preserves context data during conversion", () => {
      const contextData = { userMessage: "Test", level: 5 };
      const sessionExport = {
        exportVersion: "1.0" as const,
        exportedAt: new Date().toISOString(),
        journey: { id: "j", slug: "j", name: "J" },
        user: { id: "u", platformUserId: "p", displayName: "U" },
        session: {
          id: "s",
          status: "active" as const,
          currentNodeId: "n",
          context: contextData,
          tags: [],
          nodeOutputs: {},
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
    hasStarted: false,
        },
        interactions: [],
      };

      const journey = sessionExportToEnhancedJourney(sessionExport);
      expect(journey.context).toEqual(contextData);
    });

    it("preserves tags during conversion", () => {
      const tags = ["priority:high", "customer:acme"];
      const sessionExport = {
        exportVersion: "1.0" as const,
        exportedAt: new Date().toISOString(),
        journey: { id: "j", slug: "j", name: "J" },
        user: { id: "u", platformUserId: "p", displayName: "U" },
        session: {
          id: "s",
          status: "active" as const,
          currentNodeId: "n",
          context: {},
          tags,
          nodeOutputs: {},
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
    hasStarted: false,
        },
        interactions: [],
      };

      const journey = sessionExportToEnhancedJourney(sessionExport);
      expect(journey.tags).toEqual(tags);
    });

    it("handles completed sessions with completedAt timestamp", () => {
      const completedAt = new Date().toISOString();
      const sessionExport = {
        exportVersion: "1.0" as const,
        exportedAt: new Date().toISOString(),
        journey: { id: "j", slug: "j", name: "J" },
        user: { id: "u", platformUserId: "p", displayName: "U" },
        session: {
          id: "s",
          status: "completed" as const,
          currentNodeId: "n",
          context: {},
          tags: [],
          nodeOutputs: {},
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt,
        },
        interactions: [],
      };

      const journey = sessionExportToEnhancedJourney(sessionExport);
      expect(journey.completedAt).toBe(completedAt);
    });
  });

  describe("Round-Trip Validation", () => {
    it("validates simple JSON structure matches schema", () => {
      const sessionExport = {
        exportVersion: "1.0" as const,
        exportedAt: new Date().toISOString(),
        journey: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          slug: "journey-slug",
          name: "Journey Name",
        },
        user: {
          id: "user-id",
          platformUserId: "platform:123",
          displayName: "User Name",
        },
        session: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          status: "active" as const,
          currentNodeId: "node-1",
          context: {},
          tags: [],
          nodeOutputs: {},
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
    hasStarted: false,
        },
        interactions: [],
      };

      const result = SessionExportSchema.safeParse(sessionExport);
      expect(result.success).toBe(true);
    });

    it("maintains data integrity through export-to-import cycle", () => {
      const original = {
        exportVersion: "1.0" as const,
        exportedAt: new Date().toISOString(),
        journey: { id: "550e8400-e29b-41d4-a716-446655440000", slug: "test", name: "Test" },
        user: { id: "user-id-123", platformUserId: "p:1", displayName: "User" },
        session: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          status: "active" as const,
          currentNodeId: "start",
          context: { key: "value" },
          tags: ["tag1"],
          nodeOutputs: {},
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          completedAt: null,
    hasStarted: false,
        },
        interactions: [],
      };

      const json = JSON.stringify(original);
      const validated = validateSessionJson(json);

      expect(validated.success).toBe(true);
      if (validated.success) {
        // Verify critical fields match original
        expect(validated.data.journey.slug).toBe(original.journey.slug);
        expect(validated.data.user.id).toBe(original.user.id);
        expect(validated.data.session.status).toBe(original.session.status);
      }
    });
  });

  describe("Performance", () => {
    it("converts sessions to EnhancedUserJourney efficiently", () => {
      const now = new Date();
      const sessionExport = {
        exportVersion: "1.0" as const,
        exportedAt: now.toISOString(),
        journey: { id: "550e8400-e29b-41d4-a716-446655440002", slug: "test", name: "Test" },
        user: { id: "user-id-2", platformUserId: "p:1", displayName: "User" },
        session: {
          id: "550e8400-e29b-41d4-a716-446655440003",
          status: "active" as const,
          currentNodeId: "node",
          context: { data: "complex" },
          tags: ["tag1", "tag2", "tag3"],
          nodeOutputs: {},
          startedAt: now.toISOString(),
          updatedAt: now.toISOString(),
          completedAt: null,
    hasStarted: false,
        },
        interactions: Array.from({ length: 100 }, (_, i) => ({
          type: "message" as const,
          role: (i % 2 === 0 ? "user" : "assistant") as const,
          content: `Message ${i}`,
          timestamp: new Date(now.getTime() + i * 1000).toISOString(),
          nodeId: "node",
        })),
      };

      const startTime = performance.now();
      const journey = sessionExportToEnhancedJourney(sessionExport);
      const duration = performance.now() - startTime;

      expect(journey.history.length).toBe(100);
      expect(duration).toBeLessThan(100); // Should complete in < 100ms
    });
  });
});
