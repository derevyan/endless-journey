/**
 * Schema Mock Generator - Unit Tests
 *
 * Tests for generating mock data from variable schema definitions.
 * These functions are used by the variable preview UI to show
 * realistic example values based on schema types and formats.
 */

import { describe, expect, it } from "vitest";
import type { VariableProperty, VariableSchemas } from "../../variables/variable-schema";
import {
  generateMockFromSchema,
  generateSchemaPathMock,
  generateFullSchemaMock,
} from "../schema-mock-generator";

describe("schema-mock-generator", () => {
  // ===========================================================================
  // generateMockFromSchema
  // ===========================================================================

  describe("generateMockFromSchema", () => {
    describe("enum handling", () => {
      it("returns first enum value for string enums", () => {
        const schema: VariableProperty = {
          type: "string",
          enum: ["free", "pro", "enterprise"],
        };
        expect(generateMockFromSchema(schema)).toBe("free");
      });

      it("returns first enum value for number enums", () => {
        const schema: VariableProperty = {
          type: "number",
          enum: [10, 20, 30],
        };
        expect(generateMockFromSchema(schema)).toBe(10);
      });

      it("handles single-item enum", () => {
        const schema: VariableProperty = {
          type: "string",
          enum: ["only-option"],
        };
        expect(generateMockFromSchema(schema)).toBe("only-option");
      });

      it("handles two-item enum (returns first, not second)", () => {
        const schema: VariableProperty = {
          type: "string",
          enum: ["yes", "no"],
        };
        // Previously returned "no" (middle index), now returns "yes" (first)
        expect(generateMockFromSchema(schema)).toBe("yes");
      });
    });

    describe("default values", () => {
      it("returns default value when provided", () => {
        const schema: VariableProperty = {
          type: "string",
          default: "my-default",
        };
        expect(generateMockFromSchema(schema)).toBe("my-default");
      });

      it("enum takes precedence over default", () => {
        const schema: VariableProperty = {
          type: "string",
          enum: ["enum-value"],
          default: "default-value",
        };
        expect(generateMockFromSchema(schema)).toBe("enum-value");
      });
    });

    describe("string type", () => {
      it("generates email for email format", () => {
        const schema: VariableProperty = { type: "string", format: "email" };
        expect(generateMockFromSchema(schema)).toBe("user@example.com");
      });

      it("generates URI for uri format", () => {
        const schema: VariableProperty = { type: "string", format: "uri" };
        expect(generateMockFromSchema(schema)).toBe("https://example.com/resource");
      });

      it("generates date-time ISO string for date-time format", () => {
        const schema: VariableProperty = { type: "string", format: "date-time" };
        expect(generateMockFromSchema(schema)).toBe("2026-01-05T10:30:00Z");
      });

      it("generates date string for date format", () => {
        const schema: VariableProperty = { type: "string", format: "date" };
        expect(generateMockFromSchema(schema)).toBe("2026-01-05");
      });

      it("generates UUID for uuid format", () => {
        const schema: VariableProperty = { type: "string", format: "uuid" };
        expect(generateMockFromSchema(schema)).toBe("550e8400-e29b-41d4-a716-446655440000");
      });

      it("generates phone for phone format", () => {
        const schema: VariableProperty = { type: "string", format: "phone" };
        expect(generateMockFromSchema(schema)).toBe("+1-555-123-4567");
      });

      it("infers name from description", () => {
        const schema: VariableProperty = { type: "string", description: "User's full name" };
        expect(generateMockFromSchema(schema)).toBe("Alex Thompson");
      });

      it("infers email from description", () => {
        const schema: VariableProperty = { type: "string", description: "Contact email address" };
        expect(generateMockFromSchema(schema)).toBe("user@example.com");
      });

      it("returns default string for unknown format/description", () => {
        const schema: VariableProperty = { type: "string" };
        expect(generateMockFromSchema(schema)).toBe("sample_value");
      });
    });

    describe("number type", () => {
      it("generates default number", () => {
        const schema: VariableProperty = { type: "number" };
        expect(generateMockFromSchema(schema)).toBe(42);
      });

      it("generates age from description", () => {
        const schema: VariableProperty = { type: "number", description: "User age" };
        expect(generateMockFromSchema(schema)).toBe(28);
      });

      it("generates score from description", () => {
        const schema: VariableProperty = { type: "number", description: "Performance score" };
        expect(generateMockFromSchema(schema)).toBe(85);
      });

      it("generates price from description", () => {
        const schema: VariableProperty = { type: "number", description: "Product price" };
        expect(generateMockFromSchema(schema)).toBe(49.99);
      });
    });

    describe("boolean type", () => {
      it("returns true", () => {
        const schema: VariableProperty = { type: "boolean" };
        expect(generateMockFromSchema(schema)).toBe(true);
      });
    });

    describe("object type", () => {
      it("generates object from nested properties", () => {
        const schema: VariableProperty = {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            age: { type: "number", description: "User age" },
          },
        };
        expect(generateMockFromSchema(schema)).toEqual({
          email: "user@example.com",
          age: 28,
        });
      });

      it("returns empty object for object without properties", () => {
        const schema: VariableProperty = { type: "object" };
        expect(generateMockFromSchema(schema)).toEqual({});
      });

      it("handles deeply nested objects", () => {
        const schema: VariableProperty = {
          type: "object",
          properties: {
            profile: {
              type: "object",
              properties: {
                name: { type: "string", description: "name" },
              },
            },
          },
        };
        expect(generateMockFromSchema(schema)).toEqual({
          profile: {
            name: "Alex Thompson",
          },
        });
      });
    });

    describe("array type", () => {
      it("generates array with 2 items from items schema", () => {
        const schema: VariableProperty = {
          type: "array",
          items: { type: "string", format: "email" },
        };
        expect(generateMockFromSchema(schema)).toEqual([
          "user@example.com",
          "user@example.com",
        ]);
      });

      it("returns empty array for array without items", () => {
        const schema: VariableProperty = { type: "array" };
        expect(generateMockFromSchema(schema)).toEqual([]);
      });

      it("handles array of objects", () => {
        const schema: VariableProperty = {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "identifier" },
            },
          },
        };
        expect(generateMockFromSchema(schema)).toEqual([
          { id: "id_abc123" },
          { id: "id_abc123" },
        ]);
      });
    });
  });

  // ===========================================================================
  // generateSchemaPathMock
  // ===========================================================================

  describe("generateSchemaPathMock", () => {
    const testSchemas: VariableSchemas = {
      user: {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          profile: {
            type: "object",
            properties: {
              tier: { type: "string", enum: ["free", "pro"] },
              preferences: {
                type: "object",
                properties: {
                  theme: { type: "string", enum: ["light", "dark"] },
                },
              },
            },
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      session: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          status: { type: "string", enum: ["active", "completed"] },
        },
      },
      custom: {
        orderData: {
          type: "object",
          properties: {
            total: { type: "number", description: "price" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sku: { type: "string" },
                },
              },
            },
          },
        },
        simpleVar: {
          type: "string",
          enum: ["option1", "option2"],
        },
      },
    };

    describe("user paths", () => {
      it("resolves user.email", () => {
        expect(generateSchemaPathMock(testSchemas, "user.email")).toBe("user@example.com");
      });

      it("resolves user.profile.tier", () => {
        expect(generateSchemaPathMock(testSchemas, "user.profile.tier")).toBe("free");
      });

      it("resolves deeply nested user.profile.preferences.theme", () => {
        expect(generateSchemaPathMock(testSchemas, "user.profile.preferences.theme")).toBe("light");
      });

      it("returns undefined for non-existent path", () => {
        expect(generateSchemaPathMock(testSchemas, "user.nonexistent")).toBeUndefined();
      });
    });

    describe("session paths", () => {
      it("resolves session.id", () => {
        expect(generateSchemaPathMock(testSchemas, "session.id")).toBe("550e8400-e29b-41d4-a716-446655440000");
      });

      it("resolves session.status", () => {
        expect(generateSchemaPathMock(testSchemas, "session.status")).toBe("active");
      });
    });

    describe("vars (custom) paths", () => {
      it("resolves vars.orderData (full object)", () => {
        expect(generateSchemaPathMock(testSchemas, "vars.orderData")).toEqual({
          total: 49.99,
          items: [{ sku: "sample_value" }, { sku: "sample_value" }],
        });
      });

      it("resolves vars.orderData.total", () => {
        expect(generateSchemaPathMock(testSchemas, "vars.orderData.total")).toBe(49.99);
      });

      it("resolves vars.simpleVar (simple custom variable)", () => {
        expect(generateSchemaPathMock(testSchemas, "vars.simpleVar")).toBe("option1");
      });

      it("returns undefined for non-existent custom var", () => {
        expect(generateSchemaPathMock(testSchemas, "vars.nonexistent")).toBeUndefined();
      });
    });

    describe("array path notation", () => {
      it("resolves array items with [0] notation", () => {
        expect(generateSchemaPathMock(testSchemas, "user.tags[0]")).toBe("sample_value");
      });

      it("resolves nested object in array with [0]", () => {
        expect(generateSchemaPathMock(testSchemas, "vars.orderData.items[0].sku")).toBe("sample_value");
      });
    });

    describe("edge cases", () => {
      it("returns undefined for empty path", () => {
        expect(generateSchemaPathMock(testSchemas, "")).toBeUndefined();
      });

      it("returns undefined for invalid category", () => {
        expect(generateSchemaPathMock(testSchemas, "invalid.path")).toBeUndefined();
      });

      it("returns undefined when schema is missing", () => {
        expect(generateSchemaPathMock({}, "user.email")).toBeUndefined();
      });

      it("handles vars without rest path", () => {
        expect(generateSchemaPathMock(testSchemas, "vars")).toBeUndefined();
      });
    });
  });

  // ===========================================================================
  // generateFullSchemaMock
  // ===========================================================================

  describe("generateFullSchemaMock", () => {
    it("generates full mock for all schemas", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
          },
        },
        session: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["active"] },
          },
        },
        custom: {
          preference: { type: "string", default: "default-pref" },
        },
      };

      const result = generateFullSchemaMock(schemas);

      expect(result.user).toEqual({ email: "user@example.com" });
      expect(result.session).toEqual({ status: "active" });
      expect(result.custom).toEqual({ preference: "default-pref" });
    });

    it("handles missing schemas gracefully", () => {
      const result = generateFullSchemaMock({});

      expect(result.user).toBeUndefined();
      expect(result.session).toBeUndefined();
      expect(result.custom).toBeUndefined();
    });

    it("handles partial schemas", () => {
      const schemas: VariableSchemas = {
        user: {
          type: "object",
          properties: { name: { type: "string", description: "name" } },
        },
      };

      const result = generateFullSchemaMock(schemas);

      expect(result.user).toEqual({ name: "Alex Thompson" });
      expect(result.session).toBeUndefined();
      expect(result.custom).toBeUndefined();
    });
  });
});
