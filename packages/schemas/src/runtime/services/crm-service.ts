import type { Pipeline, PipelineStage } from "../../crm";

/**
 * Options for adding a user to a pipeline.
 */
export interface AddToPipelineOptions {
  /** Initial stage ID (uses default if not specified) */
  stageId?: string;
  /** Initial position in the stage */
  position?: number;
  /** Deal value in cents */
  dealValue?: number;
  /** Currency code (e.g., "USD") */
  currency?: string;
  /** Owner/assignee ID */
  ownerId?: string;
  /** Initial notes */
  notes?: string;
}

/**
 * Contact information for CRM updates.
 */
export interface ContactData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  /** Custom fields */
  customFields?: Record<string, unknown>;
}

/**
 * Note metadata for CRM notes.
 */
export interface NoteMetadata {
  /** Source of the note (agent, user, system) */
  source?: "agent" | "user" | "system" | "automation";
  /** Related journey/workflow ID */
  journeyId?: string;
  /** Related node ID */
  nodeId?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * User's position in a pipeline.
 */
export interface UserPipelinePosition {
  /** Pipeline ID */
  pipelineId: string;
  /** Pipeline name */
  pipelineName: string;
  /** Current stage ID */
  stageId: string;
  /** Current stage name */
  stageName: string;
  /** Position within the stage */
  position: number;
  /** Deal value in cents (if applicable) */
  dealValue?: number;
  /** Currency code */
  currency?: string;
  /** Owner/assignee ID */
  ownerId?: string;
  /** When added to pipeline */
  addedAt: Date;
  /** When last moved to current stage */
  movedAt: Date;
}

/**
 * CRM service interface for pipeline and contact management.
 *
 * The primary method is `updateClientPosition` which provides a simplified
 * interface for common pipeline operations. Advanced implementations may
 * provide granular methods for fine-grained control.
 *
 * @example
 * ```typescript
 * // Simplified: Update client's pipeline position (always available)
 * await services.crm.updateClientPosition(clientId, "sales-pipeline", "qualified");
 *
 * // Advanced: Add to pipeline with options (if available)
 * await services.crm.addToPipeline?.(userId, "sales-pipeline", {
 *   stageId: "new-lead",
 *   dealValue: 10000
 * });
 *
 * // Advanced: Create a note (if available)
 * await services.crm.createNote?.(userId, "Lead showed high interest");
 * ```
 */
export interface ICrmService {
  // =========================================================================
  // Primary Method (always available)
  // =========================================================================

  /**
   * Update client's CRM position (simplified interface).
   *
   * Service determines whether to create or move based on current state:
   * - If client not in pipeline → add to pipeline at stage
   * - If client in pipeline → move to new stage
   *
   * This is the primary method that all implementations must provide.
   *
   * @param clientId - Client ID
   * @param pipelineId - Optional target pipeline ID (uses default if not specified)
   * @param stageId - Optional target stage ID (uses default if not specified)
   * @param notes - Optional notes for the activity log
   */
  updateClientPosition(clientId: string, pipelineId?: string, stageId?: string, notes?: string): Promise<void>;

  // =========================================================================
  // Pipeline Management (optional - for granular control)
  // =========================================================================

  /**
   * Add a client to a CRM pipeline.
   *
   * @param clientId - Client ID
   * @param pipelineId - Pipeline ID (optional, uses default)
   * @param stageId - Initial stage ID (optional)
   * @param notes - Optional notes
   */
  addToPipeline?(clientId: string, pipelineId?: string, stageId?: string, notes?: string): Promise<void>;

  /**
   * Remove a client from a pipeline.
   *
   * @param clientId - Client ID
   * @param pipelineId - Pipeline ID
   */
  removeFromPipeline?(clientId: string, pipelineId: string): Promise<void>;

  /**
   * Move a client to a different stage.
   *
   * @param clientId - Client ID
   * @param stageId - Target stage ID
   * @param notes - Optional notes
   */
  moveToStage?(clientId: string, stageId: string, notes?: string): Promise<void>;

  /**
   * Update a user's position within a stage.
   *
   * @param userId - User/client ID
   * @param pipelineId - Pipeline ID or slug
   * @param position - New position (1-based)
   */
  updatePosition?(userId: string, pipelineId: string, position: number): Promise<void>;

  // =========================================================================
  // Deal Management (optional)
  // =========================================================================

  /**
   * Set the deal value for a user in a pipeline.
   *
   * @param userId - User/client ID
   * @param pipelineId - Pipeline ID or slug
   * @param value - Deal value in cents
   * @param currency - Currency code (default: "USD")
   */
  setDealValue?(userId: string, pipelineId: string, value: number, currency?: string): Promise<void>;

  /**
   * Assign an owner to a user's deal in a pipeline.
   *
   * @param userId - User/client ID
   * @param pipelineId - Pipeline ID or slug
   * @param ownerId - Owner/team member ID
   */
  assignOwner?(userId: string, pipelineId: string, ownerId: string): Promise<void>;

  // =========================================================================
  // Contact Management (optional)
  // =========================================================================

  /**
   * Update contact information for a user.
   *
   * @param userId - User/client ID
   * @param contactData - Contact information to update
   */
  updateContact?(userId: string, contactData: ContactData): Promise<void>;

  /**
   * Create a note for a user.
   *
   * @param userId - User/client ID
   * @param content - Note content
   * @param metadata - Optional note metadata
   */
  createNote?(userId: string, content: string, metadata?: NoteMetadata): Promise<void>;

  // =========================================================================
  // Read Operations (optional)
  // =========================================================================

  /**
   * Get all available pipelines.
   *
   * @returns Array of pipelines
   */
  getPipelines?(): Promise<Pipeline[]>;

  /**
   * Get a user's position in a specific pipeline.
   *
   * @param userId - User/client ID
   * @param pipelineId - Pipeline ID or slug
   * @returns User's position or null if not in pipeline
   */
  getUserPipeline?(userId: string, pipelineId: string): Promise<UserPipelinePosition | null>;

  /**
   * Get all pipeline positions for a user.
   *
   * @param userId - User/client ID
   * @returns Array of pipeline positions
   */
  getUserPipelines?(userId: string): Promise<UserPipelinePosition[]>;

  /**
   * Get all stages for a pipeline.
   *
   * @param pipelineId - Pipeline ID or slug
   * @returns Array of stages
   */
  getStages?(pipelineId: string): Promise<PipelineStage[]>;

  /**
   * Get the default pipeline for the organization.
   *
   * @returns Default pipeline or null
   */
  getDefaultPipeline?(): Promise<Pipeline | null>;

  /**
   * Get notes for a user.
   *
   * @param userId - User/client ID
   * @param limit - Maximum number of notes to return
   * @returns Array of notes
   */
  getNotes?(userId: string, limit?: number): Promise<Array<{ content: string; createdAt: Date; metadata?: NoteMetadata }>>;
}
