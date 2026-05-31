/**
 * Prompt Compile Service
 *
 * Compiles prompts by resolving {{variable}} templates.
 * Supports both text and chat message formats.
 *
 * @module modules/prompts/services/compile-service
 */

import { createLogger, serializeError } from "@journey/logger";
import type { CompiledPrompt, PromptChatMessage } from "@journey/schemas";
import { BadRequestError } from "@journey/schemas";
import { resolveTemplate } from "@journey/llm/workflow";

import { getVersionByLabel as getCachedVersionByLabel, getVersion as getCachedVersion } from "./cached-service";
import { resolvePromptContent } from "./prompt-helpers";
import * as promptService from "./prompt-service";
import type { PromptServiceContext } from "./service-context";

const log = createLogger("compile-service");

// =============================================================================
// TYPES
// =============================================================================

interface CompileOptions {
  /** Resolve by label (default: "production") */
  label?: string;
  /** Resolve by specific version ID (overrides label) */
  versionId?: string;
}

// =============================================================================
// COMPILE PROMPT
// =============================================================================

/**
 * Compile a prompt by resolving template variables.
 *
 * This is the main entry point for runtime prompt resolution.
 * Agent nodes call this to get a fully compiled prompt.
 *
 * Resolution priority:
 * 1. If `versionId` is set → pin to that exact version
 * 2. Otherwise → resolve via `label` (defaults to "production")
 *
 * @param promptName - Prompt name
 * @param variables - Variables to resolve in templates
 * @param options - Resolution options (versionId or label)
 * @returns Compiled prompt with resolved content
 */
export async function compilePrompt(
  ctx: PromptServiceContext,
  promptName: string,
  variables: Record<string, unknown>,
  options?: CompileOptions
): Promise<CompiledPrompt> {
  const { versionId, label = "production" } = options ?? {};

  try {
    // Get prompt metadata
    const prompt = await promptService.getPromptByName(ctx, promptName);

    // Get the version: versionId takes precedence over label
    const version = versionId
      ? await getCachedVersion(ctx, promptName, versionId)
      : await getCachedVersionByLabel(ctx, promptName, label);

    const resolvedContent = resolvePromptContent(prompt.type, version.content);
    if (!resolvedContent) {
      throw new BadRequestError("Prompt content does not match prompt type", { promptName, versionId });
    }

    // Compile content based on prompt type
    const compiledContent = resolvedContent.text
      ? compileTextPrompt(resolvedContent.text, variables)
      : compileChatPrompt(resolvedContent.chat ?? [], variables);

    const result: CompiledPrompt = {
      name: prompt.name,
      type: prompt.type,
      versionId: version.versionId,
      label: versionId ? undefined : label,
      content: compiledContent,
    };

    log.info(
      {
        promptName,
        versionId: version.versionId,
        label: versionId ? undefined : label,
        variableCount: Object.keys(variables).length,
      },
      "compileService:compiled"
    );

    return result;
  } catch (error) {
    log.error({ promptName, organizationId: ctx.organizationId, err: serializeError(error) }, "compileService:compile:error");
    throw error;
  }
}

// =============================================================================
// COMPILE HELPERS
// =============================================================================

/**
 * Compile a text prompt (simple string template).
 */
export function compileTextPrompt(content: string, variables: Record<string, unknown>): string {
  return resolveTemplate(content, variables);
}

/**
 * Compile a chat prompt (array of messages).
 */
export function compileChatPrompt(
  messages: PromptChatMessage[],
  variables: Record<string, unknown>
): PromptChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: resolveTemplate(message.content, variables),
  }));
}

// =============================================================================
// VARIABLE EXTRACTION
// =============================================================================

/**
 * Extract variable names from prompt content.
 * Useful for UI to show which variables are required.
 *
 * @param content - Prompt content (string or messages)
 * @returns Array of unique variable names
 */
export function extractVariables(content: string | PromptChatMessage[]): string[] {
  // Get all text to search
  const text =
    typeof content === "string"
      ? content
      : content.map((m) => m.content).join(" ");

  // Match {{variable}} patterns
  const pattern = /\{\{([^}]+)\}\}/g;
  const matches = text.matchAll(pattern);

  // Extract unique variable names
  const variables = new Set<string>();
  for (const match of matches) {
    const varName = match[1].trim();
    // For nested paths like "user.name", extract the root variable
    const rootVar = varName.split(".")[0];
    variables.add(rootVar);
  }

  return Array.from(variables).sort();
}

/**
 * Extract full variable paths from prompt content.
 * Includes nested paths like "user.name".
 *
 * @param content - Prompt content (string or messages)
 * @returns Array of unique variable paths
 */
export function extractVariablePaths(content: string | PromptChatMessage[]): string[] {
  const text =
    typeof content === "string"
      ? content
      : content.map((m) => m.content).join(" ");

  const pattern = /\{\{([^}]+)\}\}/g;
  const matches = text.matchAll(pattern);

  const paths = new Set<string>();
  for (const match of matches) {
    paths.add(match[1].trim());
  }

  return Array.from(paths).sort();
}

/**
 * Validate that all required variables are provided.
 *
 * @param content - Prompt content
 * @param variables - Provided variables
 * @returns Object with validation result and missing variables
 */
export function validateVariables(
  content: string | PromptChatMessage[],
  variables: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const required = extractVariables(content);
  const provided = new Set(Object.keys(variables));

  const missing = required.filter((v) => !provided.has(v));

  return {
    valid: missing.length === 0,
    missing,
  };
}
