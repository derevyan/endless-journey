/**
 * Tag Service
 *
 * CRUD operations for tag assignments (client_tags) and tag definitions.
 * Tags are global (organization-wide) and follow users across all journeys.
 *
 * @module modules/tags/services/tag-service
 */

import { and, desc, eq, inArray } from "drizzle-orm";

import type { DbClient } from "@journey/db";
import { clients, clientTags, journeys, journeySessions, tagDefinitions } from "@journey/db/schema";
import { createLogger, serializeError } from "@journey/logger";
import { BadRequestError, NotFoundError } from "@journey/schemas";
import type {
  ClientTagRecord,
  CreateTagDefinitionParams,
  IApiTagService,
  Tag,
  TagDefinition,
  TagOperations,
  TagOperationEventContext,
  UpdateTagDefinitionParams,
} from "@journey/schemas";

import type { IEventPublisher } from "../../../services/interfaces";

const log = createLogger("tag-service");

// =============================================================================
// SERVICE
// =============================================================================

export class ApiTagService implements IApiTagService {
  public readonly organizationId: string;

  constructor(
    private readonly db: DbClient,
    organizationId: string,
    private readonly publisher: IEventPublisher,
    private readonly defaultClientId?: string
  ) {
    this.organizationId = organizationId;
  }

  // =========================================================================
  // ITagService
  // =========================================================================

  async executeTagAction(add?: string[], remove?: string[]): Promise<void> {
    const clientId = this.requireClientId(this.defaultClientId);
    await this.executeOperations(clientId, { add, remove }, { triggeredBy: "journey" });
  }

  async getTags(): Promise<string[]> {
    const clientId = this.requireClientId(this.defaultClientId);
    return this.getClientTagNames(clientId);
  }

  async getAllAvailableTags(): Promise<Tag[]> {
    const definitions = await this.getTagDefinitions();
    return definitions.map((definition) => ({
      id: definition.id,
      name: definition.name,
      label: definition.name,
      color: definition.color ?? undefined,
      createdAt: definition.createdAt ?? undefined,
    }));
  }

  // =========================================================================
  // CLIENT TAGS
  // =========================================================================

  async getClientTags(clientId: string): Promise<ClientTagRecord[]> {
    try {
      const results = await this.db
        .select({
          clientId: clientTags.clientId,
          tagId: clientTags.tagId,
          tagName: tagDefinitions.name,
          tagColor: tagDefinitions.color,
          tagDescription: tagDefinitions.description,
          createdAt: clientTags.createdAt,
        })
        .from(clientTags)
        .innerJoin(tagDefinitions, eq(tagDefinitions.id, clientTags.tagId))
        .where(eq(clientTags.clientId, clientId));

      log.debug({ clientId, count: results.length }, "tagService:getClientTags");
      return results;
    } catch (error) {
      log.error({ clientId, err: serializeError(error) }, "tagService:getClientTags:error");
      throw error;
    }
  }

  async getClientTagNames(clientId: string): Promise<string[]> {
    const tags = await this.getClientTags(clientId);
    return tags.map((t) => t.tagName);
  }

  async assignTagToClient(clientId: string, tagId: string): Promise<void> {
    await this.assertClientExists(clientId);

    try {
      await this.db
        .insert(clientTags)
        .values({
          clientId,
          tagId,
          createdAt: new Date(),
        })
        .onConflictDoNothing();

      log.info({ clientId, tagId }, "tagService:assignTagToClient");
    } catch (error) {
      log.error({ clientId, tagId, err: serializeError(error) }, "tagService:assignTagToClient:error");
      throw error;
    }
  }

  async removeTagFromClient(clientId: string, tagId: string): Promise<boolean> {
    await this.assertClientExists(clientId);

    try {
      const result = await this.db
        .delete(clientTags)
        .where(and(eq(clientTags.clientId, clientId), eq(clientTags.tagId, tagId)))
        .returning({ clientId: clientTags.clientId });

      const deleted = result.length > 0;
      log.info({ clientId, tagId, deleted }, "tagService:removeTagFromClient");
      return deleted;
    } catch (error) {
      log.error({ clientId, tagId, err: serializeError(error) }, "tagService:removeTagFromClient:error");
      throw error;
    }
  }

  // =========================================================================
  // ENGINE-FRIENDLY TAG OPERATIONS
  // =========================================================================

  async executeOperations(
    clientId: string,
    operations: TagOperations,
    context?: TagOperationEventContext
  ): Promise<void> {
    const { add, remove } = operations;
    const triggeredBy = context?.triggeredBy ?? "journey";
    const performedBy = context?.performedBy ?? "system";

    const tagEventContext = {
      organizationId: this.organizationId,
      clientId,
      sessionId: context?.sessionId,
      journeyId: context?.journeyId,
      triggeredBy,
      performedBy,
    };

    if (add && add.length > 0) {
      for (const tagName of add) {
        try {
          const tagId = await this.ensureTag(tagName, performedBy);
          await this.assignTagToClient(clientId, tagId);
          await this.publisher.tag.added(tagEventContext, { tagId, tagName });
        } catch (error) {
          log.error(
            { clientId, tagName, err: serializeError(error) },
            "tagService:executeTagOperations:addTagFailed"
          );
          if (error instanceof Error && error.message.includes("not found")) {
            throw error;
          }
        }
      }
    }

    if (remove && remove.length > 0) {
      for (const tagName of remove) {
        try {
          const tagDef = await this.db
            .select({ id: tagDefinitions.id })
            .from(tagDefinitions)
            .where(and(eq(tagDefinitions.organizationId, this.organizationId), eq(tagDefinitions.name, tagName)))
            .limit(1);

          if (tagDef.length > 0) {
            await this.removeTagFromClient(clientId, tagDef[0].id);
            await this.publisher.tag.removed(tagEventContext, { tagId: tagDef[0].id, tagName });
          }
        } catch (error) {
          log.error(
            { clientId, tagName, err: serializeError(error) },
            "tagService:executeTagOperations:removeTagFailed"
          );
          if (error instanceof Error && error.message.includes("not found")) {
            throw error;
          }
        }
      }
    }

    log.debug({ clientId, addCount: add?.length || 0, removeCount: remove?.length || 0 }, "tagService:executeTagOperations");
  }

  // =========================================================================
  // ORGANIZATION-LEVEL QUERIES
  // =========================================================================

  async getAllUniqueTagsForOrganization(): Promise<string[]> {
    try {
      const clientTagsResult = await this.db
        .selectDistinct({ name: tagDefinitions.name })
        .from(clientTags)
        .innerJoin(tagDefinitions, eq(tagDefinitions.id, clientTags.tagId))
        .innerJoin(clients, eq(clients.id, clientTags.clientId))
        .innerJoin(journeySessions, eq(journeySessions.clientId, clients.id))
        .innerJoin(journeys, eq(journeys.id, journeySessions.journeyId))
        .where(eq(journeys.organizationId, this.organizationId));

      const uniqueTags = clientTagsResult.map((row) => row.name).sort();
      log.debug({ organizationId: this.organizationId, tagCount: uniqueTags.length }, "tagService:getAllUniqueTagsForOrganization");

      return uniqueTags;
    } catch (error) {
      log.error({ organizationId: this.organizationId, err: serializeError(error) }, "tagService:getAllUniqueTagsForOrganization:error");
      throw error;
    }
  }

  async getAllTagsForUsers(clientIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();

    if (clientIds.length === 0) {
      return result;
    }

    try {
      const clientTagsList = await this.db
        .select({
          clientId: clientTags.clientId,
          name: tagDefinitions.name,
        })
        .from(clientTags)
        .innerJoin(tagDefinitions, eq(tagDefinitions.id, clientTags.tagId))
        .where(inArray(clientTags.clientId, clientIds));

      const tagSets = new Map<string, Set<string>>();

      for (const row of clientTagsList) {
        const existing = tagSets.get(row.clientId) || new Set<string>();
        existing.add(row.name);
        tagSets.set(row.clientId, existing);
      }

      for (const [userId, tags] of tagSets) {
        result.set(userId, Array.from(tags));
      }

      log.debug({ userCount: clientIds.length, resultCount: result.size }, "tagService:getAllTagsForUsers");

      return result;
    } catch (error) {
      log.error({ userCount: clientIds.length, err: serializeError(error) }, "tagService:getAllTagsForUsers:error");
      throw error;
    }
  }

  async verifyClientBelongsToOrg(clientId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ sessionId: journeySessions.id })
        .from(journeySessions)
        .innerJoin(journeys, eq(journeys.id, journeySessions.journeyId))
        .where(and(eq(journeySessions.clientId, clientId), eq(journeys.organizationId, this.organizationId)))
        .limit(1);

      const belongs = result.length > 0;
      log.debug({ clientId, organizationId: this.organizationId, belongs }, "tagService:verifyClientBelongsToOrg");
      return belongs;
    } catch (error) {
      log.error(
        { clientId, organizationId: this.organizationId, err: serializeError(error) },
        "tagService:verifyClientBelongsToOrg:error"
      );
      return false;
    }
  }

  // =========================================================================
  // TAG DEFINITIONS (registry)
  // =========================================================================

  async getTagDefinitions(): Promise<TagDefinition[]> {
    try {
      const results = await this.db
        .select({
          id: tagDefinitions.id,
          organizationId: tagDefinitions.organizationId,
          name: tagDefinitions.name,
          description: tagDefinitions.description,
          color: tagDefinitions.color,
          createdAt: tagDefinitions.createdAt,
          updatedAt: tagDefinitions.updatedAt,
        })
        .from(tagDefinitions)
        .where(eq(tagDefinitions.organizationId, this.organizationId))
        .orderBy(desc(tagDefinitions.updatedAt));

      log.debug({ organizationId: this.organizationId, count: results.length }, "tagRegistry:getTagDefinitions");
      return results;
    } catch (error) {
      log.error({ organizationId: this.organizationId, err: serializeError(error) }, "tagRegistry:getTagDefinitions:error");
      throw error;
    }
  }

  async getTagDefinitionByName(name: string): Promise<TagDefinition | null> {
    try {
      const results = await this.db
        .select({
          id: tagDefinitions.id,
          organizationId: tagDefinitions.organizationId,
          name: tagDefinitions.name,
          description: tagDefinitions.description,
          color: tagDefinitions.color,
          createdAt: tagDefinitions.createdAt,
          updatedAt: tagDefinitions.updatedAt,
        })
        .from(tagDefinitions)
        .where(and(eq(tagDefinitions.organizationId, this.organizationId), eq(tagDefinitions.name, name)))
        .limit(1);

      return results[0] ?? null;
    } catch (error) {
      log.error({ organizationId: this.organizationId, name, err: serializeError(error) }, "tagRegistry:getTagDefinitionByName:error");
      throw error;
    }
  }

  async createTagDefinition(input: CreateTagDefinitionParams): Promise<TagDefinition> {
    try {
      const existing = await this.getTagDefinitionByName(input.name);

      if (existing) {
        log.debug({ organizationId: this.organizationId, name: input.name }, "tagRegistry:createTagDefinition:alreadyExists");
        return existing;
      }

      const [created] = await this.db
        .insert(tagDefinitions)
        .values({
          organizationId: this.organizationId,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({
          id: tagDefinitions.id,
          organizationId: tagDefinitions.organizationId,
          name: tagDefinitions.name,
          description: tagDefinitions.description,
          color: tagDefinitions.color,
          createdAt: tagDefinitions.createdAt,
          updatedAt: tagDefinitions.updatedAt,
        });

      log.info({ organizationId: this.organizationId, name: input.name }, "tagRegistry:createTagDefinition");

      await this.publisher.tag.definitionCreated(
        { organizationId: this.organizationId, performedBy: input.performedBy || "system" },
        { tagId: created.id, tagName: created.name, color: created.color }
      );

      return created;
    } catch (error) {
      log.error({ input, err: serializeError(error) }, "tagRegistry:createTagDefinition:error");
      throw error;
    }
  }

  async updateTagDefinition(tagId: string, updates: UpdateTagDefinitionParams): Promise<TagDefinition | null> {
    try {
      const { performedBy, ...changes } = updates;

      const [updated] = await this.db
        .update(tagDefinitions)
        .set({
          ...(changes.name !== undefined && { name: changes.name }),
          ...(changes.description !== undefined && { description: changes.description }),
          ...(changes.color !== undefined && { color: changes.color }),
          updatedAt: new Date(),
        })
        .where(eq(tagDefinitions.id, tagId))
        .returning({
          id: tagDefinitions.id,
          organizationId: tagDefinitions.organizationId,
          name: tagDefinitions.name,
          description: tagDefinitions.description,
          color: tagDefinitions.color,
          createdAt: tagDefinitions.createdAt,
          updatedAt: tagDefinitions.updatedAt,
        });

      if (!updated) {
        log.warn({ tagId }, "tagRegistry:updateTagDefinition:notFound");
        return null;
      }

      log.info({ tagId, updates }, "tagRegistry:updateTagDefinition");

      await this.publisher.tag.definitionUpdated(
        { organizationId: updated.organizationId, performedBy: performedBy || "system" },
        { tagId: updated.id, tagName: updated.name, changes }
      );

      return updated;
    } catch (error) {
      log.error({ tagId, updates, err: serializeError(error) }, "tagRegistry:updateTagDefinition:error");
      throw error;
    }
  }

  async deleteTagDefinition(tagId: string, performedBy?: string): Promise<boolean> {
    try {
      const existing = await this.getTagDefinitionById(tagId);

      const result = await this.db
        .delete(tagDefinitions)
        .where(eq(tagDefinitions.id, tagId))
        .returning({ id: tagDefinitions.id });

      const deleted = result.length > 0;
      log.info({ tagId, deleted }, "tagRegistry:deleteTagDefinition");

      if (deleted && existing) {
        await this.publisher.tag.definitionDeleted(
          { organizationId: existing.organizationId, performedBy: performedBy || "system" },
          { tagId, tagName: existing.name }
        );
      }

      return deleted;
    } catch (error) {
      log.error({ tagId, err: serializeError(error) }, "tagRegistry:deleteTagDefinition:error");
      throw error;
    }
  }

  async ensureTag(name: string, performedBy?: string): Promise<string> {
    try {
      const existing = await this.getTagDefinitionByName(name);

      if (existing) {
        return existing.id;
      }

      const created = await this.createTagDefinition({ name, performedBy });

      log.debug({ organizationId: this.organizationId, name, tagId: created.id }, "tagRegistry:ensureTag:created");

      return created.id;
    } catch (error) {
      log.error({ organizationId: this.organizationId, name, err: serializeError(error) }, "tagRegistry:ensureTag:error");
      throw error;
    }
  }

  async ensureTags(names: string[], performedBy?: string): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    for (const name of names) {
      const tagId = await this.ensureTag(name, performedBy);
      result.set(name, tagId);
    }

    return result;
  }

  // =========================================================================
  // INTERNAL HELPERS
  // =========================================================================

  private requireClientId(clientId?: string): string {
    if (!clientId) {
      throw new BadRequestError("clientId is required for tag operations");
    }

    return clientId;
  }

  private async assertClientExists(clientId: string): Promise<void> {
    const client = await this.db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (client.length === 0) {
      log.warn({ clientId }, "tagService:clientNotFound");
      throw new NotFoundError("Client", clientId);
    }
  }

  private async getTagDefinitionById(tagId: string): Promise<TagDefinition | null> {
    try {
      const results = await this.db
        .select({
          id: tagDefinitions.id,
          organizationId: tagDefinitions.organizationId,
          name: tagDefinitions.name,
          description: tagDefinitions.description,
          color: tagDefinitions.color,
          createdAt: tagDefinitions.createdAt,
          updatedAt: tagDefinitions.updatedAt,
        })
        .from(tagDefinitions)
        .where(eq(tagDefinitions.id, tagId))
        .limit(1);

      return results[0] ?? null;
    } catch (error) {
      log.error({ tagId, err: serializeError(error) }, "tagRegistry:getTagDefinitionById:error");
      throw error;
    }
  }
}
