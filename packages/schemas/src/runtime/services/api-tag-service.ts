import type { ITagService, Tag } from "./tag-service";

export interface ClientTagRecord {
  clientId: string;
  tagId: string;
  tagName: string;
  tagColor: string | null;
  tagDescription: string | null;
  createdAt: Date | null;
}

export interface TagDefinition {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface CreateTagDefinitionParams {
  name: string;
  description?: string | null;
  color?: string | null;
  performedBy?: string;
}

export interface UpdateTagDefinitionParams {
  name?: string;
  description?: string | null;
  color?: string | null;
  performedBy?: string;
}

export interface TagOperations {
  add?: string[];
  remove?: string[];
}

export type TagOperationTrigger = "journey" | "manual" | "automation" | "webhook";

export interface TagOperationEventContext {
  triggeredBy: TagOperationTrigger;
  performedBy?: string;
  clientId?: string;
  sessionId?: string;
  journeyId?: string;
}

export interface IApiTagService extends ITagService {
  getClientTags(clientId: string): Promise<ClientTagRecord[]>;
  getClientTagNames(clientId: string): Promise<string[]>;
  assignTagToClient(clientId: string, tagId: string): Promise<void>;
  removeTagFromClient(clientId: string, tagId: string): Promise<boolean>;
  executeOperations(
    clientId: string,
    operations: TagOperations,
    context?: TagOperationEventContext
  ): Promise<void>;

  getAllUniqueTagsForOrganization(): Promise<string[]>;
  getAllTagsForUsers(clientIds: string[]): Promise<Map<string, string[]>>;
  verifyClientBelongsToOrg(clientId: string): Promise<boolean>;

  getTagDefinitions(): Promise<TagDefinition[]>;
  getTagDefinitionByName(name: string): Promise<TagDefinition | null>;
  createTagDefinition(input: CreateTagDefinitionParams): Promise<TagDefinition>;
  updateTagDefinition(tagId: string, updates: UpdateTagDefinitionParams): Promise<TagDefinition | null>;
  deleteTagDefinition(tagId: string, performedBy?: string): Promise<boolean>;
  ensureTag(name: string, performedBy?: string): Promise<string>;
  ensureTags(names: string[], performedBy?: string): Promise<Map<string, string>>;

  getAllAvailableTags?(): Promise<Tag[]>;
}
