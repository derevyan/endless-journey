import { z } from "zod";

// Re-export sampling config helpers
export { buildModelSamplingConfig, isReasoningModel } from "./sampling-config";
export type { SamplingConfig, SamplingOptions } from "./sampling-config";

export type SchemaSanitizeResult = {
  schema: z.ZodTypeAny | null;
  changed: boolean;
  reason?: string;
  typeName?: string;
};

function getZodTypeName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const def =
    (value as {
      _def?: { typeName?: string; type?: string };
      def?: { typeName?: string; type?: string };
    })._def ??
    (value as { def?: { typeName?: string; type?: string } }).def;
  return def?.typeName ?? def?.type;
}

export function sanitizeSchemaForGoogleGenAI(schema: unknown): SchemaSanitizeResult {
  const typeName = getZodTypeName(schema);

  if (!typeName) {
    return { schema: null, changed: false, reason: "non_zod" };
  }

  const isObject = typeName === "ZodObject" || typeName === "object";
  if (isObject) {
    const def = (schema as { _def?: { unknownKeys?: string; catchall?: unknown } })._def;
    const catchallType = getZodTypeName(def?.catchall);
    const isPassthrough =
      def?.unknownKeys === "passthrough" ||
      catchallType === "ZodUnknown" ||
      catchallType === "unknown" ||
      catchallType === "ZodAny" ||
      catchallType === "any";

    if (isPassthrough) {
      const stripped = (schema as z.ZodObject<z.ZodRawShape>).strip();
      return { schema: stripped, changed: true, typeName };
    }

    if (catchallType && catchallType !== "ZodNever" && catchallType !== "never") {
      return { schema: null, changed: false, reason: "catchall", typeName: catchallType };
    }

    return { schema: schema as z.ZodTypeAny, changed: false, typeName };
  }

  if (
    typeName === "ZodRecord" ||
    typeName === "ZodMap" ||
    typeName === "ZodSet" ||
    typeName === "record" ||
    typeName === "map" ||
    typeName === "set"
  ) {
    return { schema: null, changed: false, reason: "dynamic_keys", typeName };
  }

  if (
    typeName === "ZodAny" ||
    typeName === "ZodUnknown" ||
    typeName === "any" ||
    typeName === "unknown"
  ) {
    return { schema: null, changed: false, reason: "unknown_schema", typeName };
  }

  return { schema: schema as z.ZodTypeAny, changed: false, typeName };
}
