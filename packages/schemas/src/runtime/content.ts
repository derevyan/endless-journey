/**
 * Content Schema
 *
 * Defines the schema for journey content files.
 * Content is separated from structure to optimize AI editing workflows.
 *
 * Format:
 * - structure.json: Graph topology with $content: reference tokens
 * - content.json: All text content keyed by path
 */

import { z } from "zod";

// =============================================================================
// CONTENT ENTRY
// =============================================================================

/**
 * A single content entry with value and optional AI context description
 */
export const ContentEntrySchema = z.object({
  /** The actual text content */
  value: z.string(),
  /** Optional description for AI context (what this content is for) */
  description: z.string().optional(),
});

export type ContentEntry = z.infer<typeof ContentEntrySchema>;

// =============================================================================
// CONTENT FILE
// =============================================================================

/**
 * Journey content file schema
 *
 * Flat key-value structure where keys are content paths:
 * - "node-id.label" - Node label
 * - "node-id.content" - Node message content
 * - "node-id.buttons.0.text" - First button text
 * - "plugin-id.steps.0.content" - Plugin step content (e.g., follow-up messages)
 * - "edge-id.label" - Edge label
 */
export const JourneyContentSchema = z.object({
  /** Schema version for future compatibility */
  version: z.literal("1.0"),
  /** Flat content map: path -> content entry */
  content: z.record(z.string(), ContentEntrySchema),
});

export type JourneyContent = z.infer<typeof JourneyContentSchema>;

// =============================================================================
// CONTENT REFERENCE
// =============================================================================

/** Content reference token prefix */
export const CONTENT_REF_PREFIX = "$content:";

/**
 * Content reference token schema
 * Format: "$content:{path}"
 * Example: "$content:feature-intro.label"
 */
export const ContentRefSchema = z.string().refine(
  (val) => val.startsWith(CONTENT_REF_PREFIX),
  { message: `Content reference must start with '${CONTENT_REF_PREFIX}'` }
);

export type ContentRef = z.infer<typeof ContentRefSchema>;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a string is a content reference token
 */
export function isContentRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(CONTENT_REF_PREFIX);
}

/**
 * Extract the path from a content reference token
 * @param ref - Content reference (e.g., "$content:node-id.label")
 * @returns Path string (e.g., "node-id.label") or null if not a reference
 */
export function parseContentRef(ref: string): string | null {
  if (!isContentRef(ref)) return null;
  return ref.slice(CONTENT_REF_PREFIX.length);
}

/**
 * Create a content reference token from a path
 * @param path - Content path (e.g., "node-id.label")
 * @returns Reference token (e.g., "$content:node-id.label")
 */
export function createContentRef(path: string): string {
  return `${CONTENT_REF_PREFIX}${path}`;
}

/**
 * Create an empty content file structure
 */
export function createEmptyContent(): JourneyContent {
  return {
    version: "1.0",
    content: {},
  };
}

// =============================================================================
// CONTENT UTILITIES (merged from content-utils.ts)
// =============================================================================
// Functions for splitting and merging journey content.
// Used for optimizing AI editing workflows by separating
// structure (graph topology) from content (message text).

import type { EdgeType, JourneyConfig, JourneyEdgeData, JourneyNodeData } from "../journey";
import type { EdgeStyle } from "../nodes";

// =============================================================================
// EDGE STYLE HELPERS
// =============================================================================

/**
 * Edge style defaults keyed by edge type.
 * Provided by the UI theme to avoid coupling schemas to visual constants.
 */
export type EdgeStyleDefaults = Record<EdgeType, EdgeStyle>;

/**
 * Get the effective style for an edge (explicit or derived from edgeType)
 *
 * @param edgeStyleDefaults - UI theme defaults used to resolve edge styles
 */
export function getEdgeStyle(edge: JourneyEdgeData, edgeStyleDefaults: EdgeStyleDefaults): EdgeStyle {
  // Return explicit style if present (override)
  if (edge.style) return edge.style;
  // Derive from edgeType (default: "default")
  const edgeType = edge.edgeType ?? "default";
  return edgeStyleDefaults[edgeType] ?? edgeStyleDefaults.default;
}

/**
 * Check if edge style matches the default for its type
 */
function isDefaultEdgeStyle(edge: JourneyEdgeData, edgeStyleDefaults: EdgeStyleDefaults): boolean {
  if (!edge.style) return true;
  const edgeType = edge.edgeType ?? "default";
  const defaultStyle = edgeStyleDefaults[edgeType] ?? edgeStyleDefaults.default;
  return (
    edge.style.stroke === defaultStyle.stroke &&
    edge.style.strokeWidth === defaultStyle.strokeWidth &&
    edge.style.strokeDasharray === defaultStyle.strokeDasharray
  );
}

/**
 * Remove redundant style objects from edges
 * Only keeps style when it differs from the edgeType default
 *
 * @param edgeStyleDefaults - UI theme defaults used to identify redundant styles
 */
export function normalizeEdgeStyles(
  config: JourneyConfig,
  edgeStyleDefaults: EdgeStyleDefaults
): JourneyConfig {
  return {
    ...config,
    edges: config.edges.map((edge) => {
      if (isDefaultEdgeStyle(edge, edgeStyleDefaults)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { style, ...rest } = edge;
        return rest;
      }
      return edge;
    }),
  };
}

/**
 * Add explicit style objects to all edges (for export compatibility)
 *
 * @param edgeStyleDefaults - UI theme defaults used to apply edge styles
 */
export function denormalizeEdgeStyles(
  config: JourneyConfig,
  edgeStyleDefaults: EdgeStyleDefaults
): JourneyConfig {
  return {
    ...config,
    edges: config.edges.map((edge) => ({
      ...edge,
      style: getEdgeStyle(edge, edgeStyleDefaults),
    })),
  };
}

// =============================================================================
// CONTENT EXTRACTION HELPERS
// =============================================================================

/**
 * Extract a content field and replace with reference
 */
function extractContent(
  content: Record<string, ContentEntry>,
  path: string,
  value: string | undefined
): string | undefined {
  if (!value) return undefined;
  content[path] = { value };
  return createContentRef(path);
}

/**
 * Extract content from a node and return modified node data
 */
function extractNodeContent(
  node: JourneyNodeData,
  content: Record<string, ContentEntry>
): JourneyNodeData {
  const nodeId = node.id;
  const data = { ...node.data } as Record<string, unknown>;

  // All nodes have label
  if (typeof data.label === "string" && data.label) {
    data.label = extractContent(content, `${nodeId}.label`, data.label);
  }

  // Content field (start, message, end)
  if (typeof data.content === "string" && data.content) {
    data.content = extractContent(content, `${nodeId}.content`, data.content);
  }

  // Reason field (wait)
  if (typeof data.reason === "string" && data.reason) {
    data.reason = extractContent(content, `${nodeId}.reason`, data.reason);
  }

  // Notes field (crm)
  if (typeof data.notes === "string" && data.notes) {
    data.notes = extractContent(content, `${nodeId}.notes`, data.notes);
  }

  // Buttons array (message, end)
  if (Array.isArray(data.buttons)) {
    data.buttons = (data.buttons as Array<{ id: string; text: string; targetNodeId?: string }>).map(
      (btn, i) => ({
        ...btn,
        text: extractContent(content, `${nodeId}.buttons.${i}.text`, btn.text) ?? btn.text,
      })
    );
  }

  // Branches array (condition)
  if (Array.isArray(data.branches)) {
    data.branches = (data.branches as Array<{ id: string; label: string; isDefault?: boolean }>).map(
      (branch, i) => ({
        ...branch,
        label: extractContent(content, `${nodeId}.branches.${i}.label`, branch.label) ?? branch.label,
      })
    );
  }

  // Questionnaire-specific content
  if (Array.isArray(data.questions)) {
    data.questions = (data.questions as Array<{
      id: string;
      content: string;
      hint?: string;
      buttons?: Array<{ id: string; text: string }>;
    }>).map((q, qIdx) => ({
      ...q,
      content: extractContent(content, `${nodeId}.questions.${qIdx}.content`, q.content) ?? q.content,
      hint: q.hint ? extractContent(content, `${nodeId}.questions.${qIdx}.hint`, q.hint) : undefined,
      buttons: q.buttons?.map((btn, btnIdx) => ({
        ...btn,
        text: extractContent(content, `${nodeId}.questions.${qIdx}.buttons.${btnIdx}.text`, btn.text) ?? btn.text,
      })),
    }));
  }

  // Questionnaire introduction
  if (data.introduction && typeof data.introduction === "object") {
    const intro = data.introduction as { content?: string };
    if (intro.content) {
      data.introduction = {
        ...intro,
        content: extractContent(content, `${nodeId}.introduction.content`, intro.content),
      };
    }
  }

  // Questionnaire completion
  if (data.completion && typeof data.completion === "object") {
    const comp = data.completion as { content?: string };
    if (comp.content) {
      data.completion = {
        ...comp,
        content: extractContent(content, `${nodeId}.completion.content`, comp.content),
      };
    }
  }

  // Questionnaire/Agent timeout - handle both reminder.content and timeoutMessage
  if (data.timeout && typeof data.timeout === "object") {
    const timeout = data.timeout as {
      reminder?: { content?: string; beforeSeconds?: number };
      timeoutMessage?: string;
    };
    // Questionnaire timeout reminder
    if (timeout.reminder?.content) {
      data.timeout = {
        ...timeout,
        reminder: {
          ...timeout.reminder,
          content: extractContent(content, `${nodeId}.timeout.reminder.content`, timeout.reminder.content),
        },
      };
    }
    // Agent timeout message
    if (timeout.timeoutMessage) {
      data.timeout = {
        ...(data.timeout as Record<string, unknown>),
        timeoutMessage: extractContent(content, `${nodeId}.timeout.timeoutMessage`, timeout.timeoutMessage),
      };
    }
  }

  // Agent welcome message
  if (data.welcome && typeof data.welcome === "object") {
    const welcome = data.welcome as { message?: string };
    if (welcome.message) {
      data.welcome = {
        ...welcome,
        message: extractContent(content, `${nodeId}.welcome.message`, welcome.message),
      };
    }
  }

  // Agent initial prompt template
  if (data.initialPrompt && typeof data.initialPrompt === "object") {
    const prompt = data.initialPrompt as { template?: string };
    if (prompt.template) {
      data.initialPrompt = {
        ...prompt,
        template: extractContent(content, `${nodeId}.initialPrompt.template`, prompt.template),
      };
    }
  }

  // Plugin content (follow-up steps)
  if (Array.isArray(data.plugins)) {
    data.plugins = (data.plugins as Array<{
      pluginType: string;
      steps?: Array<{
        id: string;
        content?: string;
        fallbackContent?: string;
        buttons?: Array<{ id: string; text: string; targetNodeId?: string }>;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    }>).map((plugin, pluginIdx) => {
      // Only process follow-up plugins with steps
      if (plugin.pluginType !== "followup" || !Array.isArray(plugin.steps)) {
        return plugin;
      }

      return {
        ...plugin,
        steps: plugin.steps.map((step, stepIdx) => ({
          ...step,
          content: step.content
            ? extractContent(content, `${nodeId}.plugins.${pluginIdx}.steps.${stepIdx}.content`, step.content)
            : undefined,
          fallbackContent: step.fallbackContent
            ? extractContent(content, `${nodeId}.plugins.${pluginIdx}.steps.${stepIdx}.fallbackContent`, step.fallbackContent)
            : undefined,
          buttons: step.buttons?.map((btn, btnIdx) => ({
            ...btn,
            text: extractContent(
              content,
              `${nodeId}.plugins.${pluginIdx}.steps.${stepIdx}.buttons.${btnIdx}.text`,
              btn.text
            ) ?? btn.text,
          })),
        })),
      };
    });
  }

  return {
    ...node,
    data: data as JourneyNodeData["data"],
  };
}

/**
 * Extract content from an edge and return modified edge data
 */
function extractEdgeContent(
  edge: JourneyEdgeData,
  content: Record<string, ContentEntry>
): JourneyEdgeData {
  if (!edge.label) return edge;

  return {
    ...edge,
    label: extractContent(content, `${edge.id}.label`, edge.label),
  };
}

// =============================================================================
// CONTENT RESOLUTION HELPERS
// =============================================================================

/**
 * Resolve a content reference to its value
 */
function resolveContent(ref: string, content: JourneyContent): string {
  const path = parseContentRef(ref);
  if (!path) return ref; // Not a reference, return as-is

  const entry = content.content[path];
  if (!entry) {
    throw new Error(`Content reference not found: ${ref}`);
  }
  return entry.value;
}

/**
 * Recursively resolve content references in a value
 */
function resolveValue(value: unknown, content: JourneyContent): unknown {
  if (typeof value === "string") {
    return isContentRef(value) ? resolveContent(value, content) : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, content));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = resolveValue(val, content);
    }
    return result;
  }
  return value;
}

/**
 * Resolve content references in a node
 */
function resolveNodeContent(node: JourneyNodeData, content: JourneyContent): JourneyNodeData {
  return {
    ...node,
    data: resolveValue(node.data, content) as JourneyNodeData["data"],
  };
}

/**
 * Resolve content references in an edge
 */
function resolveEdgeContent(edge: JourneyEdgeData, content: JourneyContent): JourneyEdgeData {
  if (!edge.label || !isContentRef(edge.label)) return edge;

  return {
    ...edge,
    label: resolveContent(edge.label, content),
  };
}

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================

/**
 * Check if a journey configuration uses content references
 */
export function hasContentReferences(config: JourneyConfig): boolean {
  // Check nodes
  for (const node of config.nodes) {
    const data = node.data as Record<string, unknown>;
    if (isContentRef(data.label)) return true;
    if (isContentRef(data.content)) return true;
    if (isContentRef(data.reason)) return true;
    if (isContentRef(data.notes)) return true;

    // Check buttons
    if (Array.isArray(data.buttons)) {
      for (const btn of data.buttons as Array<{ text: unknown }>) {
        if (isContentRef(btn.text)) return true;
      }
    }

    // Check branches
    if (Array.isArray(data.branches)) {
      for (const branch of data.branches as Array<{ label: unknown }>) {
        if (isContentRef(branch.label)) return true;
      }
    }

    // Check questionnaire questions
    if (Array.isArray(data.questions)) {
      for (const q of data.questions as Array<{ content: unknown; hint?: unknown; buttons?: Array<{ text: unknown }> }>) {
        if (isContentRef(q.content)) return true;
        if (isContentRef(q.hint)) return true;
        if (q.buttons) {
          for (const btn of q.buttons) {
            if (isContentRef(btn.text)) return true;
          }
        }
      }
    }

    // Check questionnaire introduction
    if (data.introduction && typeof data.introduction === "object") {
      const intro = data.introduction as { content?: unknown };
      if (isContentRef(intro.content)) return true;
    }

    // Check questionnaire completion
    if (data.completion && typeof data.completion === "object") {
      const comp = data.completion as { content?: unknown };
      if (isContentRef(comp.content)) return true;
    }

    // Check timeout (questionnaire reminder and agent timeout message)
    if (data.timeout && typeof data.timeout === "object") {
      const timeout = data.timeout as { reminder?: { content?: unknown }; timeoutMessage?: unknown };
      if (isContentRef(timeout.reminder?.content)) return true;
      if (isContentRef(timeout.timeoutMessage)) return true;
    }

    // Check agent welcome message
    if (data.welcome && typeof data.welcome === "object") {
      const welcome = data.welcome as { message?: unknown };
      if (isContentRef(welcome.message)) return true;
    }

    // Check agent initial prompt template
    if (data.initialPrompt && typeof data.initialPrompt === "object") {
      const prompt = data.initialPrompt as { template?: unknown };
      if (isContentRef(prompt.template)) return true;
    }

    // Check plugin content (follow-up steps)
    if (Array.isArray(data.plugins)) {
      for (const plugin of data.plugins as Array<{
        pluginType: string;
        steps?: Array<{
          content?: unknown;
          fallbackContent?: unknown;
          buttons?: Array<{ text?: unknown }>;
        }>;
      }>) {
        if (plugin.pluginType !== "followup" || !Array.isArray(plugin.steps)) continue;
        for (const step of plugin.steps) {
          if (isContentRef(step.content)) return true;
          if (isContentRef(step.fallbackContent)) return true;
          if (step.buttons) {
            for (const btn of step.buttons) {
              if (isContentRef(btn.text)) return true;
            }
          }
        }
      }
    }
  }

  // Check edges
  for (const edge of config.edges) {
    if (isContentRef(edge.label)) return true;
  }

  return false;
}

/**
 * Split a journey configuration into structure and content
 *
 * @param config - Full journey configuration with inline content
 * @returns Object containing structure-only journey and extracted content
 */
export function splitJourneyContent(config: JourneyConfig): {
  structure: JourneyConfig;
  content: JourneyContent;
} {
  const contentMap: Record<string, ContentEntry> = {};

  // Extract content from nodes
  const structureNodes = config.nodes.map((node) => extractNodeContent(node, contentMap));

  // Extract content from edges
  const structureEdges = config.edges.map((edge) => extractEdgeContent(edge, contentMap));

  return {
    structure: {
      nodes: structureNodes,
      edges: structureEdges,
    },
    content: {
      version: "1.0",
      content: contentMap,
    },
  };
}

/**
 * Merge structure and content back into a full journey configuration
 *
 * @param structure - Structure-only journey with $content: references
 * @param content - Content file with text values
 * @returns Full journey configuration with inline content
 * @throws Error if a content reference is not found
 */
export function mergeJourneyContent(
  structure: JourneyConfig,
  content: JourneyContent
): JourneyConfig {
  // Resolve content references in nodes
  const mergedNodes = structure.nodes.map((node) => resolveNodeContent(node, content));

  // Resolve content references in edges
  const mergedEdges = structure.edges.map((edge) => resolveEdgeContent(edge, content));

  // Build result - plugins are embedded in node.data.plugins[] (resolved with node data above)
  const result: JourneyConfig = {
    nodes: mergedNodes,
    edges: mergedEdges,
  };

  return result;
}

/**
 * Split and normalize a journey (extracts content + removes redundant edge styles)
 * This is the full optimization pipeline for export.
 *
 * @param edgeStyleDefaults - UI theme defaults used to normalize edge styles
 */
export function optimizeJourneyForExport(
  config: JourneyConfig,
  edgeStyleDefaults: EdgeStyleDefaults
): {
  structure: JourneyConfig;
  content: JourneyContent;
} {
  // First normalize edge styles
  const normalizedConfig = normalizeEdgeStyles(config, edgeStyleDefaults);

  // Then split content
  return splitJourneyContent(normalizedConfig);
}

/**
 * Merge and denormalize a journey (merges content + adds explicit edge styles)
 * This is the full restoration pipeline for import.
 *
 * @param edgeStyleDefaults - UI theme defaults used to re-apply edge styles
 */
export function restoreJourneyFromExport(
  structure: JourneyConfig,
  content: JourneyContent,
  edgeStyleDefaults: EdgeStyleDefaults
): JourneyConfig {
  // First merge content
  const mergedConfig = mergeJourneyContent(structure, content);

  // Then denormalize edge styles (add explicit styles back)
  return denormalizeEdgeStyles(mergedConfig, edgeStyleDefaults);
}
