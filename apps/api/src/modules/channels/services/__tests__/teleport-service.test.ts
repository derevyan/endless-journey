/**
 * Teleport Service - Unit Tests
 *
 * Tests for context sanitization and teleport data extraction.
 * These are critical for ensuring data integrity when users
 * teleport between journeys.
 *
 * Run with: pnpm vitest run src/modules/channels/services/__tests__/teleport-service.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  sanitizeContextForTeleport,
  hasTeleportMarker,
  extractTeleportData,
} from "../teleport-service";

describe("teleport-service", () => {
  // ===========================================================================
  // sanitizeContextForTeleport - Context Sanitization
  // ===========================================================================

  describe("sanitizeContextForTeleport", () => {
    describe("removes journey-specific keys", () => {
      it("removes userResponse from context", () => {
        const context = {
          userResponse: "user's last input",
          customerId: "cust-123",
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).not.toHaveProperty("userResponse");
        expect(result).toHaveProperty("customerId", "cust-123");
      });

      it("removes __teleport marker from context", () => {
        const context = {
          __teleport: { targetJourneyId: "j-456", preserveContext: true },
          orderTotal: 99.99,
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).not.toHaveProperty("__teleport");
        expect(result).toHaveProperty("orderTotal", 99.99);
      });

      it("removes storeResponseAs from context", () => {
        const context = {
          storeResponseAs: "userName",
          language: "en",
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).not.toHaveProperty("storeResponseAs");
        expect(result).toHaveProperty("language", "en");
      });

      it("removes all three keys simultaneously", () => {
        const context = {
          userResponse: "test input",
          __teleport: { targetJourneyId: "j-456" },
          storeResponseAs: "someVar",
          preserved1: "value1",
          preserved2: 42,
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).not.toHaveProperty("userResponse");
        expect(result).not.toHaveProperty("__teleport");
        expect(result).not.toHaveProperty("storeResponseAs");
        expect(result).toEqual({
          preserved1: "value1",
          preserved2: 42,
        });
      });
    });

    describe("preserves user context data", () => {
      it("preserves custom string values", () => {
        const context = {
          userName: "John",
          email: "john@example.com",
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).toEqual(context);
      });

      it("preserves numeric values", () => {
        const context = {
          score: 150,
          balance: 99.99,
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).toEqual(context);
      });

      it("preserves nested objects", () => {
        const context = {
          user: {
            name: "John",
            preferences: { theme: "dark" },
          },
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).toEqual(context);
      });

      it("preserves arrays", () => {
        const context = {
          selectedProducts: ["product-1", "product-2"],
          tags: [{ id: 1, name: "vip" }],
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).toEqual(context);
      });
    });

    describe("handles edge cases", () => {
      it("handles empty context", () => {
        const result = sanitizeContextForTeleport({});
        expect(result).toEqual({});
      });

      it("handles context with only keys to remove", () => {
        const context = {
          userResponse: "input",
          __teleport: { targetJourneyId: "j-456" },
          storeResponseAs: "var",
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).toEqual({});
      });

      it("handles null values in preserved keys", () => {
        const context = {
          nullValue: null,
          undefinedValue: undefined,
          userResponse: "remove me",
        };
        const result = sanitizeContextForTeleport(context);
        expect(result).toHaveProperty("nullValue", null);
        expect(result).toHaveProperty("undefinedValue", undefined);
        expect(result).not.toHaveProperty("userResponse");
      });
    });
  });

  // ===========================================================================
  // hasTeleportMarker - Teleport Detection
  // ===========================================================================

  describe("hasTeleportMarker", () => {
    it("returns true when __teleport is present", () => {
      const context = {
        __teleport: { targetJourneyId: "j-456" },
      };
      expect(hasTeleportMarker(context)).toBe(true);
    });

    it("returns true when __teleport is an object", () => {
      const context = {
        __teleport: { targetJourneyId: "j-456", preserveContext: true },
      };
      expect(hasTeleportMarker(context)).toBe(true);
    });

    it("returns false when __teleport is undefined", () => {
      const context = { someKey: "value" };
      expect(hasTeleportMarker(context)).toBe(false);
    });

    it("returns false when __teleport is null", () => {
      const context = { __teleport: null };
      expect(hasTeleportMarker(context)).toBe(false);
    });

    it("returns false for empty context", () => {
      expect(hasTeleportMarker({})).toBe(false);
    });
  });

  // ===========================================================================
  // extractTeleportData - Data Extraction
  // ===========================================================================

  describe("extractTeleportData", () => {
    it("extracts complete teleport data", () => {
      const context = {
        __teleport: {
          targetJourneyId: "journey-123",
          targetNodeId: "node-456",
          preserveContext: true,
        },
      };
      const result = extractTeleportData(context);
      expect(result).toEqual({
        targetJourneyId: "journey-123",
        targetNodeId: "node-456",
        preserveContext: true,
      });
    });

    it("extracts teleport data with optional fields missing", () => {
      const context = {
        __teleport: {
          targetJourneyId: "journey-123",
          preserveContext: false,
        },
      };
      const result = extractTeleportData(context);
      expect(result).toEqual({
        targetJourneyId: "journey-123",
        targetNodeId: undefined,
        preserveContext: false,
      });
    });

    it("returns null when no teleport marker", () => {
      const context = { someKey: "value" };
      expect(extractTeleportData(context)).toBeNull();
    });

    it("returns null for null teleport marker", () => {
      const context = { __teleport: null };
      expect(extractTeleportData(context)).toBeNull();
    });
  });

  // ===========================================================================
  // Real-World Scenarios
  // ===========================================================================

  describe("real-world teleport scenarios", () => {
    it("handles e-commerce checkout to thank you journey", () => {
      const checkoutContext = {
        userResponse: "confirm",
        __teleport: {
          targetJourneyId: "thank-you-journey",
          preserveContext: true,
        },
        storeResponseAs: "confirmation",
        orderId: "order-12345",
        orderTotal: 149.99,
        customerId: "cust-789",
      };

      // Verify teleport is detected
      expect(hasTeleportMarker(checkoutContext)).toBe(true);

      // Verify teleport data is extracted
      const teleportData = extractTeleportData(checkoutContext);
      expect(teleportData?.targetJourneyId).toBe("thank-you-journey");
      expect(teleportData?.preserveContext).toBe(true);

      // Verify context is properly sanitized
      const sanitized = sanitizeContextForTeleport(checkoutContext);
      expect(sanitized).toEqual({
        orderId: "order-12345",
        orderTotal: 149.99,
        customerId: "cust-789",
      });
    });

    it("handles onboarding to main experience journey", () => {
      const onboardingContext = {
        userResponse: "skip",
        __teleport: {
          targetJourneyId: "main-experience",
          targetNodeId: "dashboard-node",
          preserveContext: true,
        },
        userName: "Alice",
        userPreferences: { theme: "dark", notifications: true },
        completedOnboarding: true,
      };

      const sanitized = sanitizeContextForTeleport(onboardingContext);
      expect(sanitized).toEqual({
        userName: "Alice",
        userPreferences: { theme: "dark", notifications: true },
        completedOnboarding: true,
      });
    });

    it("handles fresh start teleport (preserveContext: false)", () => {
      // When preserveContext is false, the calling code should pass empty context
      // But sanitization still works correctly if called
      const context = {
        __teleport: {
          targetJourneyId: "fresh-start",
          preserveContext: false,
        },
        previousData: "should be discarded by caller",
      };

      const teleportData = extractTeleportData(context);
      expect(teleportData?.preserveContext).toBe(false);

      // Even if sanitization is called, it removes __teleport correctly
      const sanitized = sanitizeContextForTeleport(context);
      expect(sanitized).not.toHaveProperty("__teleport");
    });
  });
});
