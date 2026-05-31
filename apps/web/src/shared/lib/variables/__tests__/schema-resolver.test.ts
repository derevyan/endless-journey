/**
 * Schema Resolver - Unit Tests
 *
 * Tests for flattening nested variable schema definitions into
 * flat variable paths for autocomplete functionality.
 */

import { describe, expect, it } from "vitest";
import type { VariableSchemas } from "@journey/schemas";
import { resolveSchemaVariables, resolveAllSchemaVariables } from "../schema-resolver";

describe("schema-resolver", () => {
  // ===========================================================================
  // resolveSchemaVariables - User category
  // ===========================================================================

  describe("resolveSchemaVariables - user", () => {
    it("flattens user schema to user.* paths", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            id: { type: "string", description: "User identifier" },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");

      expect(result).toHaveLength(2);
      expect(result.find((v) => v.path === "user.email")).toEqual(
        expect.objectContaining({
          path: "user.email",
          type: "string",
          category: "user",
          format: "email",
        })
      );
      expect(result.find((v) => v.path === "user.id")).toEqual(
        expect.objectContaining({
          path: "user.id",
          type: "string",
          category: "user",
          description: "User identifier",
        })
      );
    });

    it("includes enum values in variable metadata", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            tier: { type: "string", enum: ["free", "pro", "enterprise"] },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");
      const tierVar = result.find((v) => v.path === "user.tier");

      expect(tierVar?.enumValues).toEqual(["free", "pro", "enterprise"]);
    });

    it("marks required fields", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          required: ["email"],
          properties: {
            email: { type: "string" },
            nickname: { type: "string" },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");

      expect(result.find((v) => v.path === "user.email")?.isRequired).toBe(true);
      expect(result.find((v) => v.path === "user.nickname")?.isRequired).toBe(false);
    });

    it("returns empty array for missing user schema", () => {
      const result = resolveSchemaVariables({}, "user");
      expect(result).toEqual([]);
    });

    it("returns empty array for non-object user schema", () => {
      const schemas: VariableSchemas = {
        user: { type: "string" }, // Invalid - should be object
      };
      const result = resolveSchemaVariables(schemas, "user");
      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // resolveSchemaVariables - Nested objects
  // ===========================================================================

  describe("resolveSchemaVariables - nested objects", () => {
    it("flattens nested object properties", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            profile: {
              type: "object",
              properties: {
                name: { type: "string" },
                age: { type: "number" },
              },
            },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");

      const paths = result.map((v) => v.path);
      expect(paths).toContain("user.profile");
      expect(paths).toContain("user.profile.name");
      expect(paths).toContain("user.profile.age");
    });

    it("respects maxDepth limit (default 4)", () => {
      // Create deeply nested schema (5 levels)
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            l1: {
              type: "object",
              properties: {
                l2: {
                  type: "object",
                  properties: {
                    l3: {
                      type: "object",
                      properties: {
                        l4: {
                          type: "object",
                          properties: {
                            l5: { type: "string" }, // Should NOT be included (beyond maxDepth)
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");
      const paths = result.map((v) => v.path);

      expect(paths).toContain("user.l1");
      expect(paths).toContain("user.l1.l2");
      expect(paths).toContain("user.l1.l2.l3");
      expect(paths).toContain("user.l1.l2.l3.l4");
      // l5 is at depth 5, should NOT be included (maxDepth=4)
      expect(paths).not.toContain("user.l1.l2.l3.l4.l5");
    });

    it("propagates required status to nested levels", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            profile: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
                optional: { type: "string" },
              },
            },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");

      expect(result.find((v) => v.path === "user.profile.name")?.isRequired).toBe(true);
      expect(result.find((v) => v.path === "user.profile.optional")?.isRequired).toBe(false);
    });
  });

  // ===========================================================================
  // resolveSchemaVariables - Arrays
  // ===========================================================================

  describe("resolveSchemaVariables - arrays", () => {
    it("includes array property without [0] for simple item types", () => {
      // For simple arrays (string[], number[]), we don't generate [0] paths
      // since there's nothing to drill into
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");
      const paths = result.map((v) => v.path);

      expect(paths).toContain("user.tags");
      // No [0] for simple types - only generated for object arrays
      expect(paths).not.toContain("user.tags[0]");
    });

    it("flattens object items in arrays", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            orders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  total: { type: "number" },
                },
              },
            },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");
      const paths = result.map((v) => v.path);

      expect(paths).toContain("user.orders");
      expect(paths).toContain("user.orders[0]");
      expect(paths).toContain("user.orders[0].id");
      expect(paths).toContain("user.orders[0].total");
    });

    it("handles array without items schema", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            data: { type: "array" }, // No items defined
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");
      const paths = result.map((v) => v.path);

      expect(paths).toContain("user.data");
      // No [0] path when items not defined
      expect(paths).not.toContain("user.data[0]");
    });
  });

  // ===========================================================================
  // resolveSchemaVariables - Session category
  // ===========================================================================

  describe("resolveSchemaVariables - session", () => {
    it("flattens session schema to session.* paths", () => {
      const schemas: VariableSchemas = {
        session: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["active", "completed"] },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "session");

      expect(result).toHaveLength(2);
      expect(result.find((v) => v.path === "session.id")?.format).toBe("uuid");
      expect(result.find((v) => v.path === "session.status")?.enumValues).toEqual(["active", "completed"]);
    });
  });

  // ===========================================================================
  // resolveSchemaVariables - Vars (custom) category
  // ===========================================================================

  describe("resolveSchemaVariables - vars (custom)", () => {
    it("flattens custom object schemas to vars.{key}.* paths", () => {
      const schemas: VariableSchemas = {
        custom: {
          orderData: {
            type: "object",
            properties: {
              total: { type: "number" },
              currency: { type: "string" },
            },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "vars");
      const paths = result.map((v) => v.path);

      expect(paths).toContain("vars.orderData.total");
      expect(paths).toContain("vars.orderData.currency");
    });

    it("handles simple (non-object) custom schemas", () => {
      const schemas: VariableSchemas = {
        custom: {
          apiKey: { type: "string", description: "API key for external service" },
          retryCount: { type: "number" },
        },
      };

      const result = resolveSchemaVariables(schemas, "vars");

      expect(result.find((v) => v.path === "vars.apiKey")).toEqual(
        expect.objectContaining({
          path: "vars.apiKey",
          type: "string",
          category: "vars",
          description: "API key for external service",
        })
      );
      expect(result.find((v) => v.path === "vars.retryCount")?.type).toBe("number");
    });

    it("returns empty for missing custom schemas", () => {
      const result = resolveSchemaVariables({}, "vars");
      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // resolveAllSchemaVariables
  // ===========================================================================

  describe("resolveAllSchemaVariables", () => {
    it("combines all schema categories", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            email: { type: "string" },
          },
        },
        session: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
        custom: {
          preference: { type: "string" },
        },
      };

      const result = resolveAllSchemaVariables(schemas);
      const paths = result.map((v) => v.path);

      expect(paths).toContain("user.email");
      expect(paths).toContain("session.id");
      expect(paths).toContain("vars.preference");
    });

    it("handles partial schemas", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
        },
        // No session or custom
      };

      const result = resolveAllSchemaVariables(schemas);

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe("user.name");
    });

    it("returns empty array for empty schemas", () => {
      const result = resolveAllSchemaVariables({});
      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // Description generation
  // ===========================================================================

  describe("description generation", () => {
    it("uses provided description", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            email: { type: "string", description: "Primary email address" },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");
      expect(result[0].description).toBe("Primary email address");
    });

    it("generates description from enum values when no description", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");
      expect(result[0].description).toContain("active");
      expect(result[0].description).toContain("inactive");
    });

    it("generates description from format when no description", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");
      expect(result[0].description).toBe("Email address");
    });

    it("falls back to property name when no other info", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            someField: { type: "string" },
          },
        },
      };

      const result = resolveSchemaVariables(schemas, "user");
      expect(result[0].description).toBe("someField property");
    });
  });
});
