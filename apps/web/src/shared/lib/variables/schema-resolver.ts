/**
 * Schema Resolver
 *
 * Flattens nested variable schema definitions into flat variable paths
 * for autocomplete. Converts JSON Schema-like structures to AvailableVariable[].
 *
 * @module lib/variables/schema-resolver
 */

import type { VariableProperty, VariableSchemas } from "@journey/schemas";
import type { AvailableVariable } from "./variable-resolver";

/**
 * Extended variable with schema metadata for enhanced autocomplete
 */
export interface SchemaVariable extends AvailableVariable {
  /** Enum values if this is an enum type */
  enumValues?: (string | number)[];
  /** String format (email, uri, date-time, etc.) */
  format?: string;
  /** Is this a required field */
  isRequired?: boolean;
}

/**
 * Map JSON Schema type to AvailableVariable type
 */
function mapSchemaType(prop: VariableProperty): AvailableVariable["type"] {
  // Enum is essentially a string constraint, but we return the base type
  switch (prop.type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    case "array":
      return "object"; // Arrays are objects in JS
    default:
      return "any";
  }
}

/**
 * Generate description from property metadata
 */
function generateDescription(key: string, prop: VariableProperty): string {
  if (prop.description) {
    return prop.description;
  }

  // Generate description from enum values
  if (prop.enum && prop.enum.length <= 5) {
    return `One of: ${prop.enum.map((v) => JSON.stringify(v)).join(", ")}`;
  }

  // Generate description from format
  if (prop.format) {
    const formatLabels: Record<string, string> = {
      email: "Email address",
      uri: "URL",
      "date-time": "ISO date-time string",
      date: "Date (YYYY-MM-DD)",
      uuid: "UUID",
      phone: "Phone number",
    };
    return formatLabels[prop.format] || `${prop.format} formatted string`;
  }

  // Default description
  return `${key} property`;
}

/**
 * Recursively flatten schema properties into variable paths
 *
 * @param properties - Object properties from schema
 * @param basePath - Current path prefix (e.g., "user", "user.profile")
 * @param category - Variable category for all extracted variables
 * @param result - Accumulator for extracted variables
 * @param requiredKeys - Set of required property keys at current level
 * @param maxDepth - Maximum nesting depth (prevents infinite recursion)
 * @param currentDepth - Current recursion depth
 */
function flattenSchemaProperties(
  properties: Record<string, VariableProperty>,
  basePath: string,
  category: AvailableVariable["category"],
  result: SchemaVariable[],
  requiredKeys: Set<string> = new Set(),
  maxDepth: number = 4,
  currentDepth: number = 0
): void {
  if (currentDepth >= maxDepth) return;

  for (const [key, prop] of Object.entries(properties)) {
    const path = `${basePath}.${key}`;

    // Add this property as a variable
    result.push({
      path,
      type: mapSchemaType(prop),
      description: generateDescription(key, prop),
      category,
      enumValues: prop.enum,
      format: prop.format,
      isRequired: requiredKeys.has(key),
    });

    // Recurse into nested object properties
    if (prop.type === "object" && prop.properties) {
      const nestedRequired = new Set(prop.required || []);
      flattenSchemaProperties(prop.properties, path, category, result, nestedRequired, maxDepth, currentDepth + 1);
    }

    // Handle array items with object properties
    if (prop.type === "array" && prop.items?.type === "object" && prop.items.properties) {
      // Add array access pattern: path[0]
      const arrayItemPath = `${path}[0]`;
      result.push({
        path: arrayItemPath,
        type: "object",
        description: `First item in ${key} array`,
        category,
      });

      // Add nested properties of array items
      const itemRequired = new Set(prop.items.required || []);
      flattenSchemaProperties(prop.items.properties, arrayItemPath, category, result, itemRequired, maxDepth, currentDepth + 1);
    }
  }
}

/**
 * Resolve variables from schema definitions for a specific category
 *
 * @param schemas - Variable schemas container
 * @param category - Which category to resolve ("user", "session", or "vars")
 * @returns Flat array of variables with paths
 *
 * @example
 * ```typescript
 * const schemas: VariableSchemas = {
 *   user: {
 *     type: "object",
 *     properties: {
 *       email: { type: "string", format: "email" },
 *       profile: {
 *         type: "object",
 *         properties: {
 *           tier: { type: "string", enum: ["free", "pro"] }
 *         }
 *       }
 *     }
 *   }
 * };
 *
 * const vars = resolveSchemaVariables(schemas, "user");
 * // Returns:
 * // [
 * //   { path: "user.email", type: "string", format: "email", ... },
 * //   { path: "user.profile", type: "object", ... },
 * //   { path: "user.profile.tier", type: "string", enumValues: ["free", "pro"], ... }
 * // ]
 * ```
 */
export function resolveSchemaVariables(
  schemas: VariableSchemas,
  category: "user" | "session" | "vars"
): SchemaVariable[] {
  const result: SchemaVariable[] = [];

  // Get the appropriate schema for this category
  let schema: VariableProperty | undefined;
  let basePath: string;

  if (category === "user") {
    schema = schemas.user;
    basePath = "user";
  } else if (category === "session") {
    schema = schemas.session;
    basePath = "session";
  } else {
    // For vars, we need to handle custom schemas differently
    // Each key in custom becomes its own variable namespace
    if (schemas.custom) {
      for (const [key, customSchema] of Object.entries(schemas.custom)) {
        if (customSchema.type === "object" && customSchema.properties) {
          // Custom variables go under vars.{key}
          const customPath = `vars.${key}`;
          const required = new Set(customSchema.required || []);
          flattenSchemaProperties(customSchema.properties, customPath, "vars", result, required);
        } else {
          // Simple custom variable
          result.push({
            path: `vars.${key}`,
            type: mapSchemaType(customSchema),
            description: generateDescription(key, customSchema),
            category: "vars",
            enumValues: customSchema.enum,
            format: customSchema.format,
          });
        }
      }
    }
    return result;
  }

  // Process user or session schema
  if (!schema || schema.type !== "object" || !schema.properties) {
    return result;
  }

  const requiredKeys = new Set(schema.required || []);
  flattenSchemaProperties(schema.properties, basePath, category, result, requiredKeys);

  return result;
}

/**
 * Resolve ALL variables from all schema categories
 *
 * Convenience function that resolves user, session, and vars in one call.
 *
 * @param schemas - Variable schemas container
 * @returns Combined flat array of all schema-defined variables
 */
export function resolveAllSchemaVariables(schemas: VariableSchemas): SchemaVariable[] {
  const result: SchemaVariable[] = [];

  if (schemas.user) {
    result.push(...resolveSchemaVariables(schemas, "user"));
  }

  if (schemas.session) {
    result.push(...resolveSchemaVariables(schemas, "session"));
  }

  if (schemas.custom) {
    result.push(...resolveSchemaVariables(schemas, "vars"));
  }

  return result;
}
