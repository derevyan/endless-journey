import type { DbClient } from "@journey/db";
import type {
  CompiledPrompt,
  CreatePromptInput,
  CreateVersionInput,
  IApiPromptService,
  PromptChatMessage,
  PromptFilters,
  PromptListResponse,
  PromptResponse,
  PromptVersionResponse,
  UpdateLabelsInput,
  UpdatePromptInput,
} from "@journey/schemas";

import {
  compileChatPrompt,
  compilePrompt,
  compileTextPrompt,
  extractVariablePaths,
  extractVariables,
  validateVariables,
} from "./compile-service";
import * as cachedService from "./cached-service";
import * as promptService from "./prompt-service";
import type { PromptServiceContext } from "./service-context";
import * as versionService from "./version-service";

export class ApiPromptService implements IApiPromptService {
  private readonly ctx: PromptServiceContext;

  constructor(db: DbClient, organizationId: string) {
    this.ctx = { db, organizationId };
  }

  listPrompts(filters?: PromptFilters): Promise<PromptListResponse> {
    return promptService.listPrompts(this.ctx, filters);
  }

  getPromptByName(name: string): Promise<PromptResponse> {
    return promptService.getPromptByName(this.ctx, name);
  }

  getPromptById(id: string): Promise<PromptResponse> {
    return promptService.getPromptById(this.ctx, id);
  }

  createPrompt(userId: string, input: CreatePromptInput): Promise<PromptResponse> {
    return promptService.createPrompt(this.ctx, userId, input);
  }

  updatePrompt(name: string, input: UpdatePromptInput): Promise<PromptResponse> {
    return promptService.updatePrompt(this.ctx, name, input);
  }

  deletePrompt(name: string): Promise<void> {
    return promptService.deletePrompt(this.ctx, name);
  }

  listVersions(promptName: string): Promise<PromptVersionResponse[]> {
    return versionService.listVersions(this.ctx, promptName);
  }

  getVersion(promptName: string, versionId: string): Promise<PromptVersionResponse> {
    return versionService.getVersion(this.ctx, promptName, versionId);
  }

  getVersionByLabel(promptName: string, label: string): Promise<PromptVersionResponse> {
    return versionService.getVersionByLabel(this.ctx, promptName, label);
  }

  createVersion(promptName: string, userId: string, input: CreateVersionInput): Promise<PromptVersionResponse> {
    return cachedService.createVersion(this.ctx, promptName, userId, input);
  }

  updateLabels(promptName: string, versionId: string, input: UpdateLabelsInput): Promise<PromptVersionResponse> {
    return cachedService.updateLabels(this.ctx, promptName, versionId, input);
  }

  deleteVersion(promptName: string, versionId: string): Promise<void> {
    return cachedService.deleteVersion(this.ctx, promptName, versionId);
  }

  compilePrompt(
    promptName: string,
    variables: Record<string, unknown>,
    options?: { label?: string; versionId?: string }
  ): Promise<CompiledPrompt> {
    return compilePrompt(this.ctx, promptName, variables, options);
  }

  compileTextPrompt(content: string, variables: Record<string, unknown>): string {
    return compileTextPrompt(content, variables);
  }

  compileChatPrompt(messages: PromptChatMessage[], variables: Record<string, unknown>): PromptChatMessage[] {
    return compileChatPrompt(messages, variables);
  }

  extractVariables(content: string | PromptChatMessage[]): string[] {
    return extractVariables(content);
  }

  extractVariablePaths(content: string | PromptChatMessage[]): string[] {
    return extractVariablePaths(content);
  }

  validateVariables(
    content: string | PromptChatMessage[],
    variables: Record<string, unknown>
  ): { valid: boolean; missing: string[] } {
    return validateVariables(content, variables);
  }
}
