/**
 * Message Node Migration: V1 -> V2
 *
 * Adds contentFormat field with default "text".
 */

import { nodeVersionRegistry, type MigrationEntry } from "../version-registry";
import type { MessageNodeDataV1, MessageNodeData } from "../types/journey/message/schema";

const messageV1ToV2Migration: MigrationEntry<MessageNodeDataV1, MessageNodeData> = {
  nodeType: "message",
  fromVersion: 1,
  toVersion: 2,
  migrate: (v1Data: MessageNodeDataV1): MessageNodeData => ({
    ...v1Data,
    schemaVersion: 2,
    contentFormat: "text",
  }),
};

nodeVersionRegistry.registerMigration(messageV1ToV2Migration);
