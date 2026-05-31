import type { TagAction } from "../../nodes";

/**
 * Tag information.
 */
export interface Tag {
  /** Tag ID */
  id: string;
  /** Tag name/slug */
  name: string;
  /** Tag display label */
  label?: string;
  /** Tag color (for UI) */
  color?: string;
  /** When the tag was created */
  createdAt?: Date;
}

/**
 * Tag assignment result.
 */
export interface TagResult {
  /** Tags that were added */
  added: string[];
  /** Tags that were removed */
  removed: string[];
  /** Tags that already existed (not added again) */
  alreadyExisted: string[];
  /** Tags that didn't exist (not removed) */
  notFound: string[];
}

/**
 * Tag service interface for managing user tags.
 *
 * Tags are global identifiers attached to users that follow them
 * across all journeys. Tags are useful for segmentation, filtering,
 * and conditional routing.
 *
 * The primary method is `executeTagAction` which provides a simplified
 * interface for both adding and removing tags. Advanced implementations
 * may provide granular methods for fine-grained control.
 *
 * @example
 * ```typescript
 * // Simplified: Execute tag action (always available)
 * await services.tag.executeTagAction(["vip"], ["trial"]);
 *
 * // Get all tags for the user
 * const userTags = await services.tag.getTags();
 *
 * // Advanced: Check if user has a tag (if available)
 * const isVip = await services.tag.hasTag?.("vip");
 * ```
 */
export interface ITagService {
  // =========================================================================
  // Primary Methods (always available)
  // =========================================================================

  /**
   * Execute tag operations (add and/or remove tags).
   *
   * This is the primary method that all implementations must provide.
   *
   * @param add - Tags to add
   * @param remove - Tags to remove
   */
  executeTagAction(add?: string[], remove?: string[]): Promise<void>;

  /**
   * Get all tags assigned to the user.
   * No permission required (read-only).
   *
   * @returns Array of tag names
   */
  getTags(): Promise<string[]>;

  // =========================================================================
  // Granular Operations (optional - for fine-grained control)
  // =========================================================================

  /**
   * Add tags to the user.
   *
   * @param tags - Array of tag names to add
   * @returns Tags that were actually added (excludes already existing)
   */
  addTags?(tags: string[]): Promise<string[]>;

  /**
   * Remove tags from the user.
   *
   * @param tags - Array of tag names to remove
   * @returns Tags that were actually removed (excludes not found)
   */
  removeTags?(tags: string[]): Promise<string[]>;

  /**
   * Execute a complete tag action with detailed results.
   *
   * @param action - Tag action containing add/remove operations
   * @returns Result with detailed information about what was changed
   */
  executeAction?(action: TagAction): Promise<TagResult>;

  /**
   * Check if the user has a specific tag.
   * No permission required (read-only).
   *
   * @param tag - Tag name to check
   * @returns True if user has the tag
   */
  hasTag?(tag: string): Promise<boolean>;

  /**
   * Check if the user has all of the specified tags.
   * No permission required (read-only).
   *
   * @param tags - Array of tag names to check
   * @returns True if user has all tags
   */
  hasAllTags?(tags: string[]): Promise<boolean>;

  /**
   * Check if the user has any of the specified tags.
   * No permission required (read-only).
   *
   * @param tags - Array of tag names to check
   * @returns True if user has at least one tag
   */
  hasAnyTag?(tags: string[]): Promise<boolean>;

  /**
   * Set the user's tags (replaces all existing tags).
   *
   * @param tags - Array of tag names to set
   */
  setTags?(tags: string[]): Promise<void>;

  /**
   * Clear all tags from the user.
   */
  clearTags?(): Promise<void>;

  /**
   * Get all available tags for the organization.
   * No permission required (read-only).
   *
   * @returns Array of all tags
   */
  getAllAvailableTags?(): Promise<Tag[]>;
}
