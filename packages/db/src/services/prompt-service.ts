/**
 * Prompt Service
 *
 * Shared utility for loading prompt content from the prompt repository.
 * Used by both mindstate and workflow prompt resolution.
 *
 * @module services/prompt-service
 */

import { createLogger, serializeError } from "@journey/logger";
import type { PromptChatMessage } from "@journey/schemas";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import type { DbClient } from "../client";
import { prompts, promptVersions } from "../schema";

const log = createLogger("db:prompt-service");

// =============================================================================
// TYPES
// =============================================================================

/**
 * Options for prompt version resolution.
 * Priority: versionId (if set) > label (defaults to "production")
 */
export interface PromptResolutionOptions {
  /** Pin to specific version ID (e.g., "v1", "v2"). Takes precedence over label. */
  versionId?: string;
  /** Label for dynamic resolution (e.g., "production", "latest"). */
  label?: string;
}

/**
 * Result of loading a prompt with type info.
 * Used for proper handling of text vs chat prompts.
 */
export interface LoadedPrompt {
  /** Prompt type - determines content structure */
  type: "text" | "chat";
  /** Content for text prompts */
  textContent?: string;
  /** Content for chat prompts - array of messages with roles */
  chatContent?: PromptChatMessage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isPromptChatMessage(value: unknown): value is PromptChatMessage {
  if (!isRecord(value)) return false;
  return typeof value.role === "string" && typeof value.content === "string";
}

function isPromptChatMessageArray(value: unknown): value is PromptChatMessage[] {
  return Array.isArray(value) && value.every(isPromptChatMessage);
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Load prompt content by name from the repository.
 *
 * Resolution priority:
 * 1. If `versionId` is set → pin to that exact version
 * 2. Otherwise → resolve via `label` (defaults to "production")
 *
 * @param orgId - Organization ID for prompt lookup
 * @param promptName - Name of the prompt to load
 * @param options - Resolution options with versionId or label
 * @returns Prompt content string or null if not found
 */
export async function loadPromptContent(
  orgId: string,
  promptName: string,
  options: PromptResolutionOptions = {},
  client: DbClient = db
): Promise<string | null> {
  const { versionId, label = "production" } = options;

  try {
    // Find prompt by name for this organization
    const promptRow = await client
      .select({ id: prompts.id })
      .from(prompts)
      .where(and(eq(prompts.organizationId, orgId), eq(prompts.name, promptName), isNull(prompts.deletedAt)))
      .limit(1);

    if (promptRow.length === 0) {
      log.warn({ orgId, promptName }, "prompt:notFound");
      return null;
    }

    // Fetch all versions for this prompt
    const versionRows = await client
      .select({
        versionId: promptVersions.versionId,
        content: promptVersions.content,
        labels: promptVersions.labels,
      })
      .from(promptVersions)
      .where(eq(promptVersions.promptId, promptRow[0].id));

    // Resolve version: versionId takes precedence over label
    let matchingVersion;
    if (versionId) {
      // Direct lookup by versionId (pinned)
      matchingVersion = versionRows.find((v) => v.versionId === versionId);
    } else {
      // Search in labels array (dynamic)
      matchingVersion = versionRows.find((v) => {
        const labels = isStringArray(v.labels) ? v.labels : null;
        return labels?.includes(label);
      });
    }

    if (!matchingVersion) {
      log.warn({ orgId, promptName, versionId, label }, "prompt:versionNotFound");
      return null;
    }

    const content = matchingVersion.content;
    return typeof content === "string" ? content : null;
  } catch (error) {
    log.error({ orgId, promptName, err: serializeError(error) }, "prompt:loadError");
    return null;
  }
}

/**
 * Load prompt with type info from the repository.
 * Properly handles both text (string) and chat (array) prompt types.
 *
 * Resolution priority:
 * 1. If `versionId` is set → pin to that exact version
 * 2. Otherwise → resolve via `label` (defaults to "production")
 *
 * @param orgId - Organization ID for prompt lookup
 * @param promptName - Name of the prompt to load
 * @param options - Resolution options with versionId or label
 * @returns LoadedPrompt with type and content, or null if not found
 */
export async function loadPromptWithType(
  orgId: string,
  promptName: string,
  options: PromptResolutionOptions = {},
  client: DbClient = db
): Promise<LoadedPrompt | null> {
  const { versionId, label = "production" } = options;

  try {
    // Find prompt by name for this organization (including type)
    const promptRow = await client
      .select({ id: prompts.id, type: prompts.type })
      .from(prompts)
      .where(and(eq(prompts.organizationId, orgId), eq(prompts.name, promptName), isNull(prompts.deletedAt)))
      .limit(1);

    if (promptRow.length === 0) {
      log.warn({ orgId, promptName }, "prompt:notFound");
      return null;
    }

    const promptType = promptRow[0].type;

    // Fetch all versions for this prompt
    const versionRows = await client
      .select({
        versionId: promptVersions.versionId,
        content: promptVersions.content,
        labels: promptVersions.labels,
      })
      .from(promptVersions)
      .where(eq(promptVersions.promptId, promptRow[0].id));

    // Resolve version: versionId takes precedence over label
    let matchingVersion;
    if (versionId) {
      matchingVersion = versionRows.find((v) => v.versionId === versionId);
    } else {
      matchingVersion = versionRows.find((v) => {
        const labels = isStringArray(v.labels) ? v.labels : null;
        return labels?.includes(label);
      });
    }

    if (!matchingVersion) {
      log.warn({ orgId, promptName, versionId, label }, "prompt:versionNotFound");
      return null;
    }

    const content = matchingVersion.content;

    // Return based on prompt type
    if (promptType === "chat") {
      // Chat prompt - content is array of messages
      const chatContent = isPromptChatMessageArray(content) ? content : null;
      if (!chatContent) {
        log.warn({ orgId, promptName, promptType }, "prompt:invalidChatContent");
        return null;
      }
      return { type: "chat", chatContent };
    }

    if (promptType === "text") {
      // Text prompt - content is string
      const textContent = typeof content === "string" ? content : null;
      if (!textContent) {
        log.warn({ orgId, promptName, promptType }, "prompt:invalidTextContent");
        return null;
      }
      return { type: "text", textContent };
    }

    log.warn({ orgId, promptName, promptType }, "prompt:invalidPromptType");
    return null;
  } catch (error) {
    log.error({ orgId, promptName, err: serializeError(error) }, "prompt:loadWithTypeError");
    return null;
  }
}
