/**
 * Structured Output Types and Converters
 *
 * Types for the Simple mode visual schema builder and conversion
 * functions between UI representation and JSON Schema format.
 *
 * @module features/agent-workflows/types/structured-output
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Property types supported in the Simple mode editor.
 * Maps to JSON Schema types.
 */
export type PropertyType = "string" | "number" | "boolean" | "enum" | "array" | "object";

/**
 * Property definition for the Simple mode visual builder.
 */
export interface SchemaProperty {
  /** Unique identifier for React key (prevents state reuse bugs) */
  id: string;
  /** Property name (must be valid identifier) */
  name: string;
  /** Property type */
  type: PropertyType;
  /** Optional description shown to LLM */
  description?: string;
  /** Enum values (only for enum type) */
  enumValues?: string[];
  /** Whether the property is required (default: false) */
  required?: boolean;
  /** For array type: item type */
  arrayItemType?: "string" | "number" | "boolean";
}

/**
 * Structured output configuration for the Simple mode editor.
 */
export interface StructuredOutputConfig {
  /** Schema name (identifier for the response) */
  name: string;
  /** Property definitions */
  properties: SchemaProperty[];
}

/**
 * Default empty configuration for new structured outputs.
 */
export const DEFAULT_STRUCTURED_OUTPUT_CONFIG: StructuredOutputConfig = {
  name: "response",
  properties: [],
};

// =============================================================================
// CONVERTERS
// =============================================================================

/**
 * Convert Simple mode config to JSON Schema format.
 *
 * @param config - Simple mode configuration
 * @returns JSON Schema object compatible with LLM structured output
 */
export function schemaPropertiesToJsonSchema(
  config: StructuredOutputConfig
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const prop of config.properties) {
    let propSchema: Record<string, unknown>;

    switch (prop.type) {
      case "string":
        propSchema = { type: "string" };
        break;
      case "number":
        propSchema = { type: "number" };
        break;
      case "boolean":
        propSchema = { type: "boolean" };
        break;
      case "enum":
        propSchema = {
          type: "string",
          enum: prop.enumValues || [],
        };
        break;
      case "array":
        propSchema = {
          type: "array",
          items: { type: prop.arrayItemType || "string" },
        };
        break;
      case "object":
        propSchema = { type: "object" };
        break;
      default:
        propSchema = { type: "string" };
    }

    if (prop.description) {
      propSchema.description = prop.description;
    }

    properties[prop.name] = propSchema;

    // Only mark as required if explicitly set (default: optional)
    if (prop.required === true) {
      required.push(prop.name);
    }
  }

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
    title: config.name,
  };
}

/**
 * Convert JSON Schema to Simple mode config.
 * Best effort - complex schemas may lose information.
 *
 * @param schema - JSON Schema object
 * @returns Simple mode configuration
 */
export function jsonSchemaToSchemaProperties(
  schema: Record<string, unknown>
): StructuredOutputConfig {
  const name = (schema.title as string) || "response";
  const properties: SchemaProperty[] = [];
  const schemaProps = (schema.properties as Record<string, Record<string, unknown>>) || {};
  const required = (schema.required as string[]) || [];

  for (const [propName, propSchema] of Object.entries(schemaProps)) {
    const prop: SchemaProperty = {
      id: crypto.randomUUID(),
      name: propName,
      type: "string",
      required: required.includes(propName),
    };

    if (propSchema.description) {
      prop.description = propSchema.description as string;
    }

    // Determine type
    const schemaType = propSchema.type as string;
    if (propSchema.enum) {
      prop.type = "enum";
      prop.enumValues = propSchema.enum as string[];
    } else if (schemaType === "number" || schemaType === "integer") {
      prop.type = "number";
    } else if (schemaType === "boolean") {
      prop.type = "boolean";
    } else if (schemaType === "array") {
      prop.type = "array";
      const items = propSchema.items as Record<string, unknown> | undefined;
      if (items?.type === "number" || items?.type === "integer") {
        prop.arrayItemType = "number";
      } else if (items?.type === "boolean") {
        prop.arrayItemType = "boolean";
      } else {
        prop.arrayItemType = "string";
      }
    } else if (schemaType === "object") {
      prop.type = "object";
    } else {
      prop.type = "string";
    }

    properties.push(prop);
  }

  return { name, properties };
}

/**
 * Validate a property name is a valid identifier.
 */
export function isValidPropertyName(name: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
}

/**
 * Generate a default property for a given type.
 */
export function createDefaultProperty(type: PropertyType): SchemaProperty {
  const base: SchemaProperty = {
    id: crypto.randomUUID(),
    name: "",
    type,
    required: false, // Default to optional
  };

  if (type === "enum") {
    base.enumValues = [];
  } else if (type === "array") {
    base.arrayItemType = "string";
  }

  return base;
}
