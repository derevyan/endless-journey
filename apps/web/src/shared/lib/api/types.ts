/**
 * API Client Types
 *
 * All type definitions for the API client.
 * Centralized for reuse across domain modules.
 *
 * @module lib/api/types
 */

import type {
  JourneyConfigRecord as BaseJourneyConfigRecord,
  InteractionEvent,
  JourneyMindstateConfig,
  JourneySlug,
  JourneyStatus,
  JourneyUuid,
  MediaType,
  NodeOutput,
} from "@journey/schemas";

// =============================================================================
// JOURNEY TYPES
// =============================================================================

export interface JourneyMeta {
  /** Database UUID - use for API calls and internal operations */
  id: JourneyUuid;
  /** URL-friendly slug - use for routing and display */
  slug: JourneySlug;
  name: string;
  description?: string;
  status?: JourneyStatus;
  nodeCount: number;
  edgeCount: number;
  defaultPipelineId?: string | null;
  mindstateConfig?: JourneyMindstateConfig | null;
  /** Allowlist of journey IDs that users can be transferred TO from this journey */
  transferAllowlist?: string[] | null;
}

/**
 * JourneyConfigRecord for API responses (JSON serialized).
 *
 * Re-exports from @journey/schemas with Date fields as strings
 * since JSON serialization converts Date objects to ISO strings.
 */
export interface JourneyConfigRecord extends Omit<BaseJourneyConfigRecord, "createdAt" | "updatedAt"> {
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// CHANNEL TYPES
// =============================================================================

export interface Channel {
  id: string;
  userId: string;
  platform: "telegram" | "whatsapp";
  botToken: string; // Masked in responses (only last 4 chars shown)
  botUsername: string | null;
  botName: string | null;
  defaultJourneyId: JourneyUuid | null;
  defaultJourneySlug: JourneySlug | null;
  defaultJourneyName: string | null;
  isActive: boolean;
  webhookUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// =============================================================================
// SESSION TYPES
// =============================================================================

export interface SessionUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}

export interface SessionListItem {
  id: string;
  currentNodeId: string;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  user: SessionUser;
}

export interface SessionDetail {
  id: string;
  telegramUserId: string;
  botId: string;
  journeyId: string;
  currentNodeId: string;
  status: string | null;
  context: Record<string, unknown>;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  user: SessionUser;
  interactions: InteractionEvent[];
  nodeOutputs?: Record<string, NodeOutput>;
  // Session execution context (optional - populated from database when available)
  organizationId?: string;
  channelId?: string | null;
  channelName?: string;
  mode?: "live" | "test" | "simulation";
  platform?: "telegram" | "whatsapp" | "simulator" | null;
}

export interface SessionFilters {
  status?: "active" | "completed" | "dropped" | "paused";
  limit?: number;
  offset?: number;
}

// =============================================================================
// USER TYPES
// =============================================================================

export interface TelegramUser {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  platform: string;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
  sessionCount: number;
  lastActiveAt: string | null;
}

export interface TelegramUserFilters {
  journeyId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface TelegramUserSession {
  id: string;
  journeyConfigId: JourneyUuid;
  journeyName: string;
  journeySlug: JourneySlug | null;
  currentNodeId: string;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
}

// =============================================================================
// MEDIA TYPES
// =============================================================================

export interface UploadResponse {
  url: string;
  type: MediaType;
  filename: string;
}

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  filename: string;
  createdAt: string;
}

export interface UploadConfig {
  allowedTypes: {
    image: string[];
    video: string[];
  };
  maxSize: {
    image: number;
    video: number;
  };
}

// =============================================================================
// VARIABLE TYPES
// =============================================================================

export interface Variable {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface GlobalVariable extends Variable {
  organizationId: string;
}

export interface JourneyVariable extends Variable {
  journeyId: JourneyUuid;
}

// =============================================================================
// TAG TYPES
// =============================================================================

export interface GlobalTag {
  id: string;
  organizationId: string;
  tag: string;
  description: string | null;
  color: string | null;
  createdAt: string | null;
}

export interface UserTag {
  id: string;
  channelUserId: string;
  tag: string;
  createdAt: string | null;
}
