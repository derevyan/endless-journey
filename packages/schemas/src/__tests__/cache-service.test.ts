/**
 * Cache Service - Unit Tests
 *
 * Tests for cache key generation and TTL configuration.
 * These are critical for ensuring proper cache isolation between scopes.
 *
 * Run with: pnpm vitest run src/__tests__/cache-service.test.ts
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_VARIABLE_CACHE_TTL, VARIABLE_CACHE_KEYS } from "../runtime/services/cache-service";

describe("cache-service", () => {
  // ===========================================================================
  // VARIABLE_CACHE_KEYS - Cache Key Generation
  // ===========================================================================

  describe("VARIABLE_CACHE_KEYS", () => {
    describe("global scope keys", () => {
      it("generates correct key for single global variable", () => {
        const key = VARIABLE_CACHE_KEYS.global("org-123", "theme");
        expect(key).toBe("variable:global:org-123:theme");
      });

      it("generates correct key for all global variables", () => {
        const key = VARIABLE_CACHE_KEYS.globalAll("org-123");
        expect(key).toBe("variable:global:org-123:__all__");
      });

      it("handles special characters in key names", () => {
        const key = VARIABLE_CACHE_KEYS.global("org-123", "user.preferences.theme");
        expect(key).toBe("variable:global:org-123:user.preferences.theme");
      });
    });

    describe("journey scope keys", () => {
      it("generates correct key for single journey variable", () => {
        const key = VARIABLE_CACHE_KEYS.journey("journey-456", "step_count");
        expect(key).toBe("variable:journey:journey-456:step_count");
      });

      it("generates correct key for all journey variables", () => {
        const key = VARIABLE_CACHE_KEYS.journeyAll("journey-456");
        expect(key).toBe("variable:journey:journey-456:__all__");
      });
    });

    describe("user scope keys", () => {
      it("generates correct key for single user variable", () => {
        const key = VARIABLE_CACHE_KEYS.user("user-789", "language");
        expect(key).toBe("variable:user:user-789:language");
      });

      it("generates correct key for all user variables", () => {
        const key = VARIABLE_CACHE_KEYS.userAll("user-789");
        expect(key).toBe("variable:user:user-789:__all__");
      });
    });

    describe("pattern for bulk invalidation", () => {
      it("generates correct pattern for global scope", () => {
        const pattern = VARIABLE_CACHE_KEYS.pattern("global", "org-123");
        expect(pattern).toBe("variable:global:org-123:*");
      });

      it("generates correct pattern for journey scope", () => {
        const pattern = VARIABLE_CACHE_KEYS.pattern("journey", "journey-456");
        expect(pattern).toBe("variable:journey:journey-456:*");
      });

      it("generates correct pattern for user scope", () => {
        const pattern = VARIABLE_CACHE_KEYS.pattern("user", "user-789");
        expect(pattern).toBe("variable:user:user-789:*");
      });
    });

    describe("scope isolation - prevents cross-contamination", () => {
      it("global and journey keys for same ID are different", () => {
        const id = "shared-id-123";
        const key = "variable_name";

        const globalKey = VARIABLE_CACHE_KEYS.global(id, key);
        const journeyKey = VARIABLE_CACHE_KEYS.journey(id, key);
        const userKey = VARIABLE_CACHE_KEYS.user(id, key);

        expect(globalKey).not.toBe(journeyKey);
        expect(globalKey).not.toBe(userKey);
        expect(journeyKey).not.toBe(userKey);
      });

      it("all-keys for different scopes don't overlap", () => {
        const id = "shared-id-123";

        const globalAll = VARIABLE_CACHE_KEYS.globalAll(id);
        const journeyAll = VARIABLE_CACHE_KEYS.journeyAll(id);
        const userAll = VARIABLE_CACHE_KEYS.userAll(id);

        expect(globalAll).not.toBe(journeyAll);
        expect(globalAll).not.toBe(userAll);
        expect(journeyAll).not.toBe(userAll);
      });

      it("patterns don't match other scopes", () => {
        const id = "shared-id-123";

        const globalPattern = VARIABLE_CACHE_KEYS.pattern("global", id);
        const journeyPattern = VARIABLE_CACHE_KEYS.pattern("journey", id);

        // A journey key should NOT match the global pattern
        const journeyKey = VARIABLE_CACHE_KEYS.journey(id, "test");

        // Simple check: patterns have different prefixes
        expect(journeyKey.startsWith("variable:global")).toBe(false);
        expect(journeyKey.startsWith("variable:journey")).toBe(true);
      });
    });
  });

  // ===========================================================================
  // DEFAULT_VARIABLE_CACHE_TTL - TTL Configuration
  // ===========================================================================

  describe("DEFAULT_VARIABLE_CACHE_TTL", () => {
    it("global TTL is longest (rarely changes)", () => {
      expect(DEFAULT_VARIABLE_CACHE_TTL.global).toBeGreaterThan(
        DEFAULT_VARIABLE_CACHE_TTL.journey
      );
      expect(DEFAULT_VARIABLE_CACHE_TTL.global).toBeGreaterThan(
        DEFAULT_VARIABLE_CACHE_TTL.session
      );
    });

    it("session TTL is shortest (changes frequently)", () => {
      expect(DEFAULT_VARIABLE_CACHE_TTL.session).toBeLessThan(
        DEFAULT_VARIABLE_CACHE_TTL.global
      );
      expect(DEFAULT_VARIABLE_CACHE_TTL.session).toBeLessThan(
        DEFAULT_VARIABLE_CACHE_TTL.journey
      );
      expect(DEFAULT_VARIABLE_CACHE_TTL.session).toBeLessThan(
        DEFAULT_VARIABLE_CACHE_TTL.user
      );
    });

    it("expected TTL values match documentation", () => {
      // These values are documented in the code comments
      expect(DEFAULT_VARIABLE_CACHE_TTL.global).toBe(300); // 5 minutes
      expect(DEFAULT_VARIABLE_CACHE_TTL.journey).toBe(120); // 2 minutes
      expect(DEFAULT_VARIABLE_CACHE_TTL.session).toBe(60); // 1 minute
      expect(DEFAULT_VARIABLE_CACHE_TTL.user).toBe(180); // 3 minutes
    });
  });
});
