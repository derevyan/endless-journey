import type { IVariableService } from "./variable-service";
import type { IMessengerService } from "./messenger-service";
import type { IMemoryService } from "./memory-service";
import type { ICrmService } from "./crm-service";
import type { ITagService } from "./tag-service";
import type { ITemplateService } from "./template-service";
import type { ICacheService } from "./cache-service";
import type { IJourneyService } from "./journey-service";

/**
 * Optional service names for type-safe availability checks.
 */
export type OptionalServiceName = "memory" | "crm" | "mindstate" | "tag" | "dlq" | "expression" | "followUp" | "cache" | "journey";

/**
 * SharedServiceContext - The unified service access layer.
 *
 * All execution contexts (ExecutionContext, WorkflowContext, BuiltinToolContext)
 * use this interface for service access, ensuring consistent API across modules.
 *
 * Core services are always available:
 * - variable: Read/write variables
 * - template: Resolve template strings
 * - messenger: Send messages to users
 *
 * Optional services may be unavailable depending on context:
 * - memory: AI memory storage (requires AI features enabled)
 * - crm: CRM pipeline management (requires CRM module)
 * - tag: User tag management (always available for authenticated contexts)
 * - mindstate: User mindstate tracking (requires mindstate module)
 * - dlq: Dead letter queue for failed messages
 * - expression: Expression evaluation (for conditions)
 * - followUp: Follow-up/reminder scheduling
 *
 * @example
 * ```typescript
 * // Access core services (always available)
 * const value = await context.services.variable.getValue("journey", "step");
 * const message = await context.services.template.resolve("Hello {{user.firstName}}!", vars);
 * await context.services.messenger.sendMessage("Welcome!");
 *
 * // Check for optional services before use
 * if (context.services.has("memory")) {
 *   await context.services.memory!.save({ key: "preference", content: "..." });
 * }
 *
 * // Or use optional chaining
 * await context.services.crm?.moveToStage(userId, pipelineId, "qualified");
 * ```
 */
export interface SharedServiceContext {
  // =========================================================================
  // Core Services (always available)
  // =========================================================================

  /**
   * Variable service for reading and writing variables.
   * Supports journey, global, and user scopes.
   */
  readonly variable: IVariableService;

  /**
   * Template service for resolving {{variable}} placeholders.
   */
  readonly template: ITemplateService;

  /**
   * Messenger service for sending messages to users.
   */
  readonly messenger: IMessengerService;

  // =========================================================================
  // Optional Services (check availability with `has()`)
  // =========================================================================

  /**
   * Memory service for AI long-term memory.
   * May be undefined if AI features are not enabled.
   */
  readonly memory?: IMemoryService;

  /**
   * CRM service for pipeline and contact management.
   * May be undefined if CRM module is not enabled.
   */
  readonly crm?: ICrmService;

  /**
   * Tag service for user tag management.
   * Usually available for authenticated contexts.
   */
  readonly tag?: ITagService;

  /**
   * Mindstate service for user psychological state tracking.
   * May be undefined if mindstate module is not enabled.
   */
  readonly mindstate?: IMindstateService;

  /**
   * Dead letter queue service for handling failed messages.
   * May be undefined if DLQ is not configured.
   */
  readonly dlq?: IDlqService;

  /**
   * Expression evaluation service for conditions.
   * May be undefined in simple contexts.
   */
  readonly expression?: IExpressionService;

  /**
   * Follow-up scheduling service for reminders.
   * May be undefined if follow-ups are not supported.
   */
  readonly followUp?: IFollowUpService;

  /**
   * Cache service for Redis-backed caching.
   * Used internally by CachedVariableService and other cached services.
   * May be undefined if caching is not configured.
   */
  readonly cache?: ICacheService;

  /**
   * Journey service for routing users between journeys.
   * Enables AI agents and engine nodes to transfer users to other journeys.
   * May be undefined if journey routing is not enabled for this context.
   */
  readonly journey?: IJourneyService;

  // =========================================================================
  // Service Availability
  // =========================================================================

  /**
   * Check if an optional service is available.
   *
   * @param service - Service name to check
   * @returns True if the service is available
   *
   * @example
   * ```typescript
   * if (context.services.has("memory")) {
   *   await context.services.memory!.save({ ... });
   * }
   * ```
   */
  has(service: OptionalServiceName): boolean;
}

// =========================================================================
// Additional Service Interfaces (defined here for simplicity)
// =========================================================================

/**
 * Mindstate service for tracking user psychological/situational state.
 *
 * This is a minimal interface that supports the common operations across
 * all contexts. Engine implementations may have additional methods.
 */
export interface IMindstateService {
  /**
   * Get a specific parameter value from a mindstate.
   *
   * @param clientId - Client/User ID
   * @param mindstateKey - The mindstate definition key (e.g., "onboarding-progress")
   * @param parameterName - The parameter to retrieve
   * @returns The parameter value or null if not found
   */
  getParameterValue(clientId: string, mindstateKey: string, parameterName: string): Promise<unknown>;

  /**
   * Get the current mindstate for a user.
   * Optional as not all implementations support this.
   */
  getState?(userId: string): Promise<Record<string, unknown> | null>;

  /**
   * Update the mindstate based on user interaction.
   * Optional as not all implementations support direct updates.
   */
  updateState?(userId: string, updates: Record<string, unknown>): Promise<void>;

  /**
   * Analyze conversation and update mindstate.
   * Optional as this requires AI pipeline integration.
   */
  analyzeAndUpdate?(userId: string, conversation: string[]): Promise<void>;
}

/**
 * Dead letter queue service for handling failed operations.
 */
export interface IDlqService {
  /**
   * Send a failed message to the dead letter queue.
   */
  sendToDlq(params: {
    messageId: string;
    error: string;
    payload: unknown;
    retryCount?: number;
  }): Promise<void>;

  /**
   * Retry a message from the dead letter queue.
   */
  retry?(messageId: string): Promise<boolean>;
}

/**
 * Expression evaluation service for conditions.
 */
export interface IExpressionService {
  /**
   * Evaluate an expression with the given context.
   *
   * @param expression - Expression string (e.g., "visits > 5 && isVIP == true")
   * @param context - Variables available in the expression
   * @returns Expression result
   */
  evaluate(expression: string, context: Record<string, unknown>): unknown;

  /**
   * Check if an expression evaluates to truthy.
   *
   * @param expression - Expression string
   * @param context - Variables available in the expression
   * @returns True if expression is truthy
   */
  isTruthy(expression: string, context: Record<string, unknown>): boolean;

  /**
   * Validate expression syntax without evaluating.
   *
   * @param expression - Expression string
   * @returns True if syntax is valid
   */
  validate?(expression: string): boolean;
}

/**
 * Follow-up scheduling service for reminders.
 */
export interface IFollowUpService {
  /**
   * Schedule a follow-up reminder.
   *
   * @param params - Follow-up parameters
   * @returns Scheduled follow-up ID
   */
  schedule(params: {
    userId: string;
    nodeId: string;
    delaySeconds: number;
    message?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string>;

  /**
   * Cancel a scheduled follow-up.
   *
   * @param followUpId - Follow-up ID to cancel
   */
  cancel(followUpId: string): Promise<void>;

  /**
   * Cancel all follow-ups for a user.
   *
   * @param userId - User ID
   */
  cancelAllForUser(userId: string): Promise<void>;
}
