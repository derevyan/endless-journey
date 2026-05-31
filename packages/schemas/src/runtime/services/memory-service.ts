/**
 * Memory types for classification.
 */
export type MemoryType = "semantic" | "preference" | "fact" | "context";

/**
 * Memory metadata for additional context.
 */
export interface MemoryMetadata {
  /** Source of the memory */
  source?: "agent" | "user" | "system";
  /** Confidence score (0-1) */
  confidence?: number;
  /** Tags for categorization */
  tags?: string[];
  /** Custom fields */
  [key: string]: unknown;
}

/**
 * Parameters for saving a memory.
 */
export interface SaveMemoryParams {
  /** Unique key for this memory (e.g., "user_name", "food_preference") */
  key: string;
  /** The content/fact to remember */
  content: string;
  /** Memory type classification */
  memoryType?: MemoryType;
  /** Additional metadata */
  metadata?: MemoryMetadata;
}

/**
 * Result from a memory search.
 */
export interface MemorySearchResult {
  /** Memory key */
  key: string;
  /** Memory content */
  content: string;
  /** Memory type */
  memoryType: string;
  /** Similarity score (0-1) for semantic search */
  similarity: number;
}

/**
 * Basic memory result (for getRecent, get).
 */
export interface MemoryResult {
  /** Memory key */
  key: string;
  /** Memory content */
  content: string;
  /** Memory type */
  memoryType: string;
  /** When the memory was created */
  createdAt?: Date;
  /** When the memory was last updated */
  updatedAt?: Date;
}

/**
 * Memory service interface for long-term AI memory.
 *
 * Provides persistent memory storage and semantic search for agents.
 * Memories are stored per-user and can be searched using vector similarity.
 *
 * @example
 * ```typescript
 * // Save a memory about the user
 * await services.memory.save({
 *   key: "favorite_color",
 *   content: "The user's favorite color is blue",
 *   memoryType: "preference"
 * });
 *
 * // Search for relevant memories
 * const memories = await services.memory.search("What does the user like?");
 *
 * // Get recent memories for context
 * const recent = await services.memory.getRecent(5);
 * ```
 */
export interface IMemoryService {
  /**
   * Save a memory for the user.
   * Uses upsert behavior - updates existing memory if key exists.
   *
   * @param params - Memory parameters (key, content, memoryType)
   */
  save(params: SaveMemoryParams): Promise<void>;

  /**
   * Search memories using semantic similarity.
   *
   * @param query - Search query text
   * @param limit - Maximum number of results (default: 5)
   * @returns Array of matching memories with similarity scores
   */
  search(query: string, limit?: number): Promise<MemorySearchResult[]>;

  /**
   * Get recent memories for context injection.
   *
   * @param limit - Maximum number of results (default: 10)
   * @returns Array of recent memories
   */
  getRecent(limit?: number): Promise<MemoryResult[]>;

  /**
   * Get a specific memory by key.
   *
   * @param key - Memory key
   * @returns The memory if found, null otherwise
   */
  get(key: string): Promise<MemoryResult | null>;

  /**
   * Delete a memory by key.
   *
   * @param key - Memory key
   * @returns True if memory was deleted, false if not found
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a memory exists.
   *
   * @param key - Memory key
   * @returns True if memory exists
   */
  exists?(key: string): Promise<boolean>;

  /**
   * Get all memories for the user.
   * Use with caution - may return large amounts of data.
   *
   * @returns All memories for the user
   */
  getAll?(): Promise<MemoryResult[]>;

  /**
   * Clear all memories for the user.
   * Use with caution - this is destructive.
   */
  clear?(): Promise<void>;
}
