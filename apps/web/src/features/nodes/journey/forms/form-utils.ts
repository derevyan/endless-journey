/**
 * Form Utilities
 *
 * Shared helper functions for node editor forms.
 */

import type { NodeMetadata } from "@/features/nodes/journey/react-flow-types";

interface MetadataInput {
  notes?: string;
  customJson?: string;
  status?: string;
}

/**
 * Build node metadata from form values
 * Handles JSON parsing for custom data with error fallback
 */
export function buildNodeMetadata(
  existingMetadata: NodeMetadata | undefined,
  input: MetadataInput
): NodeMetadata {
  const now = new Date().toISOString();
  return {
    createdAt: existingMetadata?.createdAt || now,
    updatedAt: now,
    version: existingMetadata?.version || "1.0.0",
    status: (input.status as NodeMetadata["status"]) || existingMetadata?.status || "draft",
    notes: input.notes ?? undefined,
    custom: input.customJson
      ? (() => {
          try {
            return JSON.parse(input.customJson);
          } catch {
            return {};
          }
        })()
      : undefined,
  };
}

/**
 * Safely parse JSON string or return empty object
 */
export function safeParseJson(json: string | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/**
 * Safely stringify object for form display
 */
export function safeStringifyJson(obj: Record<string, unknown> | undefined): string {
  if (!obj) return "";
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "";
  }
}

