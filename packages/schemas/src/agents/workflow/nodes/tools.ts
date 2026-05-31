import { z } from "zod";

// =============================================================================
// GUARD NODE - Safety checks
// =============================================================================

export const GuardWorkerSchema = z.enum([
  "safety_guard", // General safety check
  "injection_guard", // Prompt injection detection
  "policy_guard", // Custom policy rules
  "spam_guard", // Spam/abuse detection
]);

export type GuardWorker = z.infer<typeof GuardWorkerSchema>;

/**
 * Guard node configuration.
 *
 * Output handles:
 * - 'passed': Message passed all guards
 * - 'blocked': Message was blocked (workflow can terminate or handle)
 */
export const GuardNodeConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  workers: z.array(GuardWorkerSchema).min(1).default(["safety_guard"]),
  blockedMessage: z.string().max(1000).default("I can't help with that request."),

  // If true, blocked stops workflow. If false, uses 'blocked' edge.
  terminateOnBlock: z.boolean().default(true),
});

export type GuardNodeConfig = z.infer<typeof GuardNodeConfigSchema>;

// =============================================================================
// CONTEXT NODE - KB/Memory/RAG injection
// =============================================================================

export const MemorySourceSchema = z.object({
  type: z.literal("memory"),
  /** Maximum number of memories to retrieve */
  maxResults: z.number().int().min(1).max(50).default(10),
  autoInject: z.boolean().default(true),
  recencyBias: z.number().min(0).max(1).default(0.3),
});

export const KnowledgeBaseSourceSchema = z.object({
  type: z.literal("knowledge_base"),
  kbId: z.string().min(1),
  /** Maximum number of chunks to retrieve */
  maxResults: z.number().int().min(1).max(20).default(5),
  similarity: z.number().min(0).max(1).default(0.7),
});

export const RAGSourceSchema = z.object({
  type: z.literal("rag"),
  indexId: z.string().min(1),
  /** Maximum number of results to retrieve (top-K) */
  maxResults: z.number().int().min(1).max(50).default(5),
  similarity: z.number().min(0).max(1).default(0.7),
});

export const ContextSourceSchema = z.discriminatedUnion("type", [
  MemorySourceSchema,
  KnowledgeBaseSourceSchema,
  RAGSourceSchema,
]);

export type ContextSource = z.infer<typeof ContextSourceSchema>;

/**
 * Context node injects relevant context from various sources.
 *
 * @experimental This node is not yet implemented.
 * All context sources will throw NotImplementedError at runtime.
 */
export const ContextNodeConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sources: z.array(ContextSourceSchema).min(1),

  // Variable to store injected context (for debugging/inspection)
  outputVariable: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .optional(),

  /**
   * @experimental This node is not yet implemented.
   * All context sources will throw NotImplementedError at runtime.
   */
  _experimental: z.literal(true).optional().default(true),
});

export type ContextNodeConfig = z.infer<typeof ContextNodeConfigSchema>;

// =============================================================================
// MCP NODE - External tool call
// =============================================================================

/**
 * MCP node calls an external MCP server tool.
 */
export const MCPNodeConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  server: z.string().min(1).max(100),
  tool: z.string().min(1).max(100),

  // Parameters can include variable templates: {{variable.path}}
  params: z.record(z.string(), z.string()).default({}),

  // Timeout in milliseconds
  timeout: z.number().int().min(1000).max(60000).default(30000),

  // What to do on error
  onError: z.enum(["fail", "continue", "retry"]).default("fail"),
  maxRetries: z.number().int().min(0).max(3).default(1),
});

export type MCPNodeConfig = z.infer<typeof MCPNodeConfigSchema>;

// =============================================================================
// QUESTION UNDERSTANDING NODE - Synthesize unanswered questions
// =============================================================================

/**
 * Question Understanding node synthesizes unanswered questions from conversation.
 *
 * Uses map-reduce pattern: multiple LLM workers synthesize in parallel,
 * evaluator selects the best synthesis.
 *
 * Output:
 * - Sets `userMessageOverride` for automatic Agent node integration
 * - Also stores in `outputVariable` for explicit reference
 *
 * When connected to Agent node, the synthesized question automatically
 * becomes the user message (no manual wiring needed).
 *
 * Fallback: When no questions are found or synthesis fails, the original
 * user message is used.
 *
 * Note: Uses fixed optimal worker configuration internally (all 5 workers).
 */
export const QuestionUnderstandingNodeConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),

  /** Variable name to store the synthesized question (for explicit access) */
  outputVariable: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .min(1)
    .max(50)
    .default("synthesized_question"),

  /** Include reasoning/metadata in output variables */
  includeReasoning: z.boolean().default(false),
});

export type QuestionUnderstandingNodeConfig = z.infer<typeof QuestionUnderstandingNodeConfigSchema>;
