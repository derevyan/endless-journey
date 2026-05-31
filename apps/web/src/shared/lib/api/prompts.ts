/**
 * Prompts API
 *
 * Operations for prompt management - CRUD, versions, compilation.
 *
 * @module lib/api/prompts
 */

import { apiUrl, authFetch } from "./base";
import type {
  PromptResponse,
  PromptListResponse,
  PromptVersionResponse,
  PromptFilters,
  CreatePromptInput,
  UpdatePromptInput,
  CreateVersionInput,
  UpdateLabelsInput,
  CompiledPrompt,
  CompilePromptInput,
} from "@journey/schemas";

// =============================================================================
// RE-EXPORT TYPES
// =============================================================================

export type {
  PromptResponse,
  PromptListResponse,
  PromptVersionResponse,
  PromptFilters,
  CreatePromptInput,
  UpdatePromptInput,
  CreateVersionInput,
  UpdateLabelsInput,
  CompiledPrompt,
  CompilePromptInput,
} from "@journey/schemas";

// =============================================================================
// PROMPTS API
// =============================================================================

export const promptsApi = {
  /**
   * List prompts with optional filters
   */
  async list(filters?: PromptFilters): Promise<PromptListResponse> {
    const params = new URLSearchParams();
    if (filters?.search) params.set("search", filters.search);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.isSystem !== undefined) params.set("isSystem", String(filters.isSystem));
    if (filters?.tags?.length) params.set("tags", filters.tags.join(","));
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));

    const queryString = params.toString();
    const url = queryString ? `${apiUrl}/api/prompts?${queryString}` : `${apiUrl}/api/prompts`;

    return authFetch<PromptListResponse>(url, undefined, { action: "listPrompts" });
  },

  /**
   * Get a prompt by name
   */
  async get(name: string): Promise<PromptResponse> {
    return authFetch<PromptResponse>(`${apiUrl}/api/prompts/${encodeURIComponent(name)}`, undefined, {
      action: "getPrompt",
    });
  },

  /**
   * Create a new prompt with initial version
   */
  async create(input: CreatePromptInput): Promise<PromptResponse> {
    return authFetch<PromptResponse>(
      `${apiUrl}/api/prompts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "createPrompt" }
    );
  },

  /**
   * Update prompt metadata (not content)
   */
  async update(name: string, input: UpdatePromptInput): Promise<PromptResponse> {
    return authFetch<PromptResponse>(
      `${apiUrl}/api/prompts/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "updatePrompt" }
    );
  },

  /**
   * Soft delete a prompt
   */
  async delete(name: string): Promise<void> {
    await authFetch<{ success: boolean }>(
      `${apiUrl}/api/prompts/${encodeURIComponent(name)}`,
      { method: "DELETE" },
      { action: "deletePrompt" }
    );
  },
};

// =============================================================================
// PROMPT VERSIONS API
// =============================================================================

export const promptVersionsApi = {
  /**
   * List all versions for a prompt
   */
  async list(promptName: string): Promise<PromptVersionResponse[]> {
    const data = await authFetch<{ versions: PromptVersionResponse[] }>(
      `${apiUrl}/api/prompts/${encodeURIComponent(promptName)}/versions`,
      undefined,
      { action: "listPromptVersions" }
    );
    return data.versions;
  },

  /**
   * Get a specific version
   */
  async get(promptName: string, versionId: string): Promise<PromptVersionResponse> {
    return authFetch<PromptVersionResponse>(
      `${apiUrl}/api/prompts/${encodeURIComponent(promptName)}/versions/${encodeURIComponent(versionId)}`,
      undefined,
      { action: "getPromptVersion" }
    );
  },

  /**
   * Create a new version
   */
  async create(promptName: string, input: CreateVersionInput): Promise<PromptVersionResponse> {
    return authFetch<PromptVersionResponse>(
      `${apiUrl}/api/prompts/${encodeURIComponent(promptName)}/versions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "createPromptVersion" }
    );
  },

  /**
   * Update version labels
   */
  async updateLabels(
    promptName: string,
    versionId: string,
    input: UpdateLabelsInput
  ): Promise<PromptVersionResponse> {
    return authFetch<PromptVersionResponse>(
      `${apiUrl}/api/prompts/${encodeURIComponent(promptName)}/versions/${encodeURIComponent(versionId)}/labels`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "updatePromptLabels" }
    );
  },

  /**
   * Delete a version
   */
  async delete(promptName: string, versionId: string): Promise<void> {
    await authFetch<{ success: boolean }>(
      `${apiUrl}/api/prompts/${encodeURIComponent(promptName)}/versions/${encodeURIComponent(versionId)}`,
      { method: "DELETE" },
      { action: "deletePromptVersion" }
    );
  },
};

// =============================================================================
// PROMPT COMPILE API
// =============================================================================

export const promptCompileApi = {
  /**
   * Compile a prompt with variables
   */
  async compile(promptName: string, input: CompilePromptInput): Promise<CompiledPrompt> {
    return authFetch<CompiledPrompt>(
      `${apiUrl}/api/prompts/${encodeURIComponent(promptName)}/compile`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      { action: "compilePrompt" }
    );
  },

  /**
   * Get variables used in a prompt
   */
  async getVariables(
    promptName: string,
    options?: { label?: string; versionId?: string }
  ): Promise<{ versionId: string; variables: string[]; paths: string[] }> {
    const params = new URLSearchParams();
    if (options?.label) params.set("label", options.label);
    if (options?.versionId) params.set("versionId", options.versionId);

    const queryString = params.toString();
    const url = queryString
      ? `${apiUrl}/api/prompts/${encodeURIComponent(promptName)}/variables?${queryString}`
      : `${apiUrl}/api/prompts/${encodeURIComponent(promptName)}/variables`;

    return authFetch<{ versionId: string; variables: string[]; paths: string[] }>(url, undefined, {
      action: "getPromptVariables",
    });
  },

  /**
   * Get compiled prompt without variables (raw content)
   */
  async getCompiled(
    promptName: string,
    label = "production"
  ): Promise<CompiledPrompt> {
    return authFetch<CompiledPrompt>(
      `${apiUrl}/api/prompts/${encodeURIComponent(promptName)}/compiled?label=${encodeURIComponent(label)}`,
      undefined,
      { action: "getCompiledPrompt" }
    );
  },
};
