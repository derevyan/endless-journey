/**
 * Template resolution context containing all available variables.
 *
 * Uses the unified namespace structure:
 * - vars.journey.* - Journey-scoped variables
 * - vars.global.* - Organization-wide variables
 * - vars.user.* - User-specific variables
 * - user.* - User profile fields
 * - session.* - Current session state
 * - nodes.* - Outputs from executed nodes
 */
export interface TemplateContext {
  /** Scoped variables by namespace */
  vars?: {
    journey?: Record<string, unknown>;
    global?: Record<string, unknown>;
    user?: Record<string, unknown>;
  };

  /** User profile information */
  user?: {
    id?: string;
    platform?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    email?: string;
    vars?: Record<string, unknown>;
  };

  /** Session state */
  session?: {
    id?: string;
    journeyId?: string;
    status?: string;
    currentNodeId?: string;
    tags?: string[];
  };

  /** Outputs from executed nodes (keyed by node label) */
  nodes?: Record<string, Record<string, unknown>>;

  /** Additional custom context */
  [key: string]: unknown;
}

/**
 * Template resolution options.
 */
export interface TemplateOptions {
  /** Whether to throw on undefined variables (default: false - returns empty string) */
  strict?: boolean;
  /** Default value for undefined variables */
  defaultValue?: string;
  /** Whether to escape HTML entities in output */
  escapeHtml?: boolean;
  /** Custom variable delimiters (default: {{ and }}) */
  delimiters?: [string, string];
}

/**
 * Template service interface for resolving template strings.
 *
 * Handles {{variable}} placeholder resolution in message content,
 * prompts, and other dynamic text. Uses a unified namespace structure
 * for consistent variable access across all modules.
 *
 * The primary method is `substitute` (synchronous, simple context).
 * Advanced implementations may also provide `resolve` (async, structured context),
 * `hasVariables`, and `extractVariables` for richer template handling.
 *
 * @example
 * ```typescript
 * // Basic substitution (always available)
 * const message = services.template.substitute(
 *   "Hello {{user.firstName}}!",
 *   { user: { firstName: "John" } }
 * );
 *
 * // Advanced: Check if template has variables (if available)
 * const hasVars = services.template.hasVariables?.("Hello {{user.firstName}}!");
 *
 * // Advanced: Extract variable paths from template (if available)
 * const paths = services.template.extractVariables?.("{{user.firstName}} {{vars.journey.orderId}}");
 * // Returns: ["user.firstName", "vars.journey.orderId"]
 * ```
 */
export interface ITemplateService {
  /**
   * Substitute template placeholders using a flat context object.
   *
   * This is the primary method that all implementations must provide.
   * Supports two modes:
   * - Simple: {{path.to.value}} - Direct variable lookup
   * - Expression: {{= expr }} - JEXL expression evaluation (if supported)
   *
   * @param template - Template string with {{variable}} placeholders
   * @param context - Flat context object for variable lookup
   * @returns Resolved string with all placeholders replaced
   */
  substitute(template: string, context: Record<string, unknown>): string;

  /**
   * Resolve template placeholders using the structured context.
   *
   * Template syntax: {{path.to.value}}
   *
   * Supported namespaces:
   * - {{vars.journey.*}} - Journey-scoped variables
   * - {{vars.global.*}} - Organization-wide variables
   * - {{vars.user.*}} - User-specific variables
   * - {{user.*}} - User profile fields (firstName, lastName, etc.)
   * - {{session.*}} - Session state (id, status, tags, etc.)
   * - {{nodes.NodeLabel.*}} - Outputs from executed nodes
   *
   * @param template - Template string with {{variable}} placeholders
   * @param context - Structured context containing variable values
   * @param options - Resolution options
   * @returns Resolved string with all placeholders replaced
   */
  resolve?(template: string, context: TemplateContext, options?: TemplateOptions): Promise<string>;

  /**
   * Synchronous version of resolve for simple cases.
   * Use when context is already fully populated.
   *
   * @param template - Template string
   * @param context - Context containing variable values
   * @param options - Resolution options
   * @returns Resolved string
   */
  resolveSync?(template: string, context: TemplateContext, options?: TemplateOptions): string;

  /**
   * Check if a string contains template variables.
   *
   * @param template - String to check
   * @returns True if string contains {{...}} placeholders
   */
  hasVariables?(template: string): boolean;

  /**
   * Extract variable paths from a template string.
   *
   * @param template - Template string
   * @returns Array of variable paths (e.g., ["user.firstName", "vars.journey.orderId"])
   */
  extractVariables?(template: string): string[];

  /**
   * Validate that all template variables exist in the context.
   *
   * @param template - Template string
   * @param context - Context to validate against
   * @returns Array of missing variable paths (empty if all exist)
   */
  validateVariables?(template: string, context: TemplateContext): string[];

  /**
   * Get the value at a path from the context.
   *
   * @param path - Dot-separated path (e.g., "user.firstName")
   * @param context - Context to get value from
   * @returns Value at path or undefined
   */
  getValueAtPath?(path: string, context: TemplateContext): unknown;
}
