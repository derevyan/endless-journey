/**
 * Schema-Based Mock Data Generator
 *
 * Generates realistic mock data from variable schema definitions.
 * Uses the JSON Schema-like VariableProperty structure to produce
 * type-aware example values for the variable preview UI.
 *
 * @module mocks/schema-mock-generator
 */

import type { VariableProperty, VariableSchemas } from "../variables/variable-schema";

/**
 * Generate mock data from a variable schema
 *
 * @param schema - Variable property schema
 * @returns Appropriate mock value based on type and format
 *
 * @example
 * ```typescript
 * const schema: VariableProperty = {
 *   type: "object",
 *   properties: {
 *     email: { type: "string", format: "email" },
 *     tier: { type: "string", enum: ["free", "pro", "enterprise"] }
 *   }
 * };
 * const mock = generateMockFromSchema(schema);
 * // Returns: { email: "user@example.com", tier: "free" }
 * ```
 */
export function generateMockFromSchema(schema: VariableProperty): unknown {
  // Use enum value if available - return first for predictability
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }

  // Use default value if provided
  if (schema.default !== undefined) {
    return schema.default;
  }

  switch (schema.type) {
    case "string":
      return generateStringMock(schema.format, schema.description);
    case "number":
      return generateNumberMock(schema.description);
    case "boolean":
      return true;
    case "object":
      return generateObjectMock(schema);
    case "array":
      return generateArrayMock(schema);
    default:
      return null;
  }
}

/**
 * Generate a string mock value based on format
 */
function generateStringMock(format?: string, description?: string): string {
  // Format-specific mocks
  switch (format) {
    case "email":
      return "user@example.com";
    case "uri":
      return "https://example.com/resource";
    case "date-time":
      return "2026-01-05T10:30:00Z";
    case "date":
      return "2026-01-05";
    case "uuid":
      return "550e8400-e29b-41d4-a716-446655440000";
    case "phone":
      return "+1-555-123-4567";
    default:
      break;
  }

  // Infer from description if no format
  const desc = (description ?? "").toLowerCase();
  if (desc.includes("name")) return "Alex Thompson";
  if (desc.includes("email")) return "user@example.com";
  if (desc.includes("phone")) return "+1-555-123-4567";
  if (desc.includes("url") || desc.includes("link")) return "https://example.com";
  if (desc.includes("id") || desc.includes("identifier")) return "id_abc123";
  if (desc.includes("token")) return "tok_xyz789";
  if (desc.includes("address")) return "123 Main Street";
  if (desc.includes("city")) return "San Francisco";
  if (desc.includes("country")) return "United States";

  // Default string
  return "sample_value";
}

/**
 * Generate a number mock value
 */
function generateNumberMock(description?: string): number {
  const desc = (description ?? "").toLowerCase();

  // Context-aware number generation
  if (desc.includes("age")) return 28;
  if (desc.includes("score") || desc.includes("rating")) return 85;
  if (desc.includes("count") || desc.includes("quantity")) return 5;
  if (desc.includes("price") || desc.includes("amount") || desc.includes("cost")) return 49.99;
  if (desc.includes("percent") || desc.includes("percentage")) return 75;
  if (desc.includes("year")) return 2026;
  if (desc.includes("month")) return 6;
  if (desc.includes("day")) return 15;

  // Default number
  return 42;
}

/**
 * Generate an object mock from nested properties
 */
function generateObjectMock(schema: VariableProperty): Record<string, unknown> {
  if (!schema.properties) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, propSchema] of Object.entries(schema.properties)) {
    result[key] = generateMockFromSchema(propSchema);
  }
  return result;
}

/**
 * Generate an array mock from items schema
 */
function generateArrayMock(schema: VariableProperty): unknown[] {
  if (!schema.items) {
    return [];
  }

  // Generate 2 example items
  return [generateMockFromSchema(schema.items), generateMockFromSchema(schema.items)];
}

/**
 * Generate mock data for a specific variable path from schemas
 *
 * @param schemas - Variable schemas container
 * @param path - Variable path (e.g., "user.profile.tier")
 * @returns Mock value for the path, or undefined if path not found
 *
 * @example
 * ```typescript
 * const mock = generateSchemaPathMock(schemas, "user.email");
 * // Returns: "user@example.com"
 * ```
 */
export function generateSchemaPathMock(schemas: VariableSchemas, path: string): unknown {
  const parts = path.split(".");
  if (parts.length === 0) return undefined;

  const [category, ...rest] = parts;

  // Get the root schema and remaining path parts for this category
  let schema: VariableProperty | undefined;
  let pathParts: string[];

  if (category === "user") {
    schema = schemas.user;
    pathParts = rest;
  } else if (category === "session") {
    schema = schemas.session;
    pathParts = rest;
  } else if (category === "vars" && rest.length > 0) {
    // vars.{key}.{path} - custom variables have an extra key level
    const [varKey, ...varPath] = rest;
    schema = schemas.custom?.[varKey];
    pathParts = varPath;

    // If no further path after varKey, return the full schema mock
    if (varPath.length === 0 && schema) {
      return generateMockFromSchema(schema);
    }
  } else {
    return undefined;
  }

  if (!schema) return undefined;

  // Expand path parts to handle combined property+array notation (e.g., "tags[0]" → ["tags", "[0]"])
  const expandedParts = expandPathParts(pathParts);

  // Navigate to the specific property using expanded path parts
  let current = schema;
  for (const part of expandedParts) {
    if (current.type === "object" && current.properties?.[part]) {
      current = current.properties[part];
    } else if (current.type === "array" && part.match(/^\[\d+\]$/) && current.items) {
      current = current.items;
    } else {
      // Path not found in schema
      return undefined;
    }
  }

  return generateMockFromSchema(current);
}

/**
 * Expand path parts to separate property names from array notation
 *
 * @example
 * expandPathParts(["tags[0]", "name"]) → ["tags", "[0]", "name"]
 * expandPathParts(["items[0].sku"]) → ["items", "[0]", "sku"]
 */
function expandPathParts(parts: string[]): string[] {
  const result: string[] = [];

  for (const part of parts) {
    // Match property name optionally followed by array index: "property[0]" or just "property"
    const match = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(\[\d+\])?$/);
    if (match) {
      const [, propName, arrayIndex] = match;
      result.push(propName);
      if (arrayIndex) {
        result.push(arrayIndex);
      }
    } else if (part.match(/^\[\d+\]$/)) {
      // Standalone array index
      result.push(part);
    } else {
      // Unknown format, pass through
      result.push(part);
    }
  }

  return result;
}

/**
 * Generate complete mock data object for all schemas
 *
 * @param schemas - Variable schemas container
 * @returns Object with user, session, and custom mocks
 */
export function generateFullSchemaMock(schemas: VariableSchemas): {
  user?: unknown;
  session?: unknown;
  custom?: Record<string, unknown>;
} {
  const result: {
    user?: unknown;
    session?: unknown;
    custom?: Record<string, unknown>;
  } = {};

  if (schemas.user) {
    result.user = generateMockFromSchema(schemas.user);
  }

  if (schemas.session) {
    result.session = generateMockFromSchema(schemas.session);
  }

  if (schemas.custom) {
    result.custom = {};
    for (const [key, schema] of Object.entries(schemas.custom)) {
      result.custom[key] = generateMockFromSchema(schema);
    }
  }

  return result;
}
