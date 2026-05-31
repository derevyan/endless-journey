import type {
  CompiledPrompt,
  CreatePromptInput,
  CreateVersionInput,
  PromptChatMessage,
  PromptFilters,
  PromptListResponse,
  PromptResponse,
  PromptVersionResponse,
  UpdateLabelsInput,
  UpdatePromptInput,
} from "../../prompts";

export interface PromptCompileOptions {
  label?: string;
  versionId?: string;
}

export interface IApiPromptService {
  listPrompts(filters?: PromptFilters): Promise<PromptListResponse>;
  getPromptByName(name: string): Promise<PromptResponse>;
  getPromptById(id: string): Promise<PromptResponse>;
  createPrompt(userId: string, input: CreatePromptInput): Promise<PromptResponse>;
  updatePrompt(name: string, input: UpdatePromptInput): Promise<PromptResponse>;
  deletePrompt(name: string): Promise<void>;

  listVersions(promptName: string): Promise<PromptVersionResponse[]>;
  getVersion(promptName: string, versionId: string): Promise<PromptVersionResponse>;
  getVersionByLabel(promptName: string, label: string): Promise<PromptVersionResponse>;
  createVersion(promptName: string, userId: string, input: CreateVersionInput): Promise<PromptVersionResponse>;
  updateLabels(promptName: string, versionId: string, input: UpdateLabelsInput): Promise<PromptVersionResponse>;
  deleteVersion(promptName: string, versionId: string): Promise<void>;

  compilePrompt(
    promptName: string,
    variables: Record<string, unknown>,
    options?: PromptCompileOptions
  ): Promise<CompiledPrompt>;
  compileTextPrompt(content: string, variables: Record<string, unknown>): string;
  compileChatPrompt(messages: PromptChatMessage[], variables: Record<string, unknown>): PromptChatMessage[];
  extractVariables(content: string | PromptChatMessage[]): string[];
  extractVariablePaths(content: string | PromptChatMessage[]): string[];
  validateVariables(
    content: string | PromptChatMessage[],
    variables: Record<string, unknown>
  ): { valid: boolean; missing: string[] };
}
