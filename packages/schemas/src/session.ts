import { z } from "zod";
import { InteractionEventSchema } from "./events/core";
import { FollowUpSequenceSchema } from "./nodes/follow-up";

// Node Output schema (for storing results from executed nodes)
export const NodeOutputSchema = z.object({
  nodeId: z.string(),
  nodeLabel: z.string(),
  nodeType: z.string(),
  executedAt: z.iso.datetime(),
  data: z.unknown(),
});

// Active Button schema (for unified button routing)
// Used to track currently displayed buttons in session state
export const ActiveButtonSchema = z.object({
  id: z.string(),
  text: z.string(),
  // targetNodeId is optional for AI quick-reply buttons (agent re-executes instead)
  targetNodeId: z.string().optional(),
  source: z.enum(["node", "questionnaire", "plugin", "agent"]),
});

// Enhanced User Journey with Event Sourcing
export const EnhancedUserJourneySchema = z.object({
  // === SNAPSHOT (fast reads) ===
  // ID fields use UUID validation for data integrity
  sessionId: z.string().uuid("sessionId must be a valid UUID"),
  userId: z.string().uuid("userId must be a valid UUID"),
  // Platform-specific user ID for messaging (Telegram numeric ID, WhatsApp phone, etc.)
  // This is used by adapters to send messages, separate from internal userId (UUID)
  platformUserId: z.string(),
  journeyId: z.string().uuid("journeyId must be a valid UUID"),
  currentNodeId: z.string(),
  status: z.enum(["active", "completed", "dropped", "paused", "error"]),

  // Current state context
  context: z.record(z.string(), z.unknown()).default({}),
  tags: z.array(z.string()).default([]),
  pendingTimers: z
    .array(
      z.object({
        timerId: z.string(),
        triggersAt: z.iso.datetime(),
        targetEdgeId: z.string(),
      })
    )
    .default([]),

  // Pending follow-up timers for plugin nodes
  pendingPluginFollowUps: z
    .array(
      z.object({
        timerId: z.string(),
        pluginId: z.string(),
        parentNodeId: z.string(),
        pluginIndex: z.number(), // Index of plugin in node.data.plugins array
        stepIndex: z.number(),
        sequence: FollowUpSequenceSchema,
        triggersAt: z.iso.datetime(),
        /** Timer type: "send" = delay before sending, "response" = wait after sending */
        timerType: z.enum(["send", "response"]).default("send"),
      })
    )
    .optional()
    .default([]),

  // Currently displayed buttons (for unified button routing)
  // Set when a message with buttons is sent, cleared on user response
  activeButtons: z.array(ActiveButtonSchema).optional(),

  // Node outputs (indexed by sanitized label for cross-node references)
  nodeOutputs: z.record(z.string(), NodeOutputSchema).default({}),

  // Timestamps
  startedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),

  // Whether the journey has been started (first node executed)
  // Used for deterministic resume detection instead of heuristics
  hasStarted: z.boolean().default(false),

  // === HISTORY (append-only event log) ===
  history: z.array(InteractionEventSchema).default([]),
});

// Type exports
export type EnhancedUserJourney = z.infer<typeof EnhancedUserJourneySchema>;
export type NodeOutput = z.infer<typeof NodeOutputSchema>;
export type ActiveButton = z.infer<typeof ActiveButtonSchema>;
