/**
 * Human-in-the-Loop (HITL) Middleware
 *
 * Enables human approval, editing, or rejection of specific tool calls.
 * Provides foundation for interactive agent workflows requiring oversight.
 * Follows LangChain's HumanInTheLoopMiddleware API.
 *
 * @see https://docs.langchain.com/oss/javascript/langchain/middleware/built-in#human-in-the-loop
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   model: "gpt-4o",
 *   middleware: [
 *     createHumanInTheLoopMiddleware({
 *       interruptOn: {
 *         "send_email": {
 *           allowedDecisions: ["approve", "edit", "reject"],
 *           description: "Review email before sending",
 *         },
 *         "delete_record": true,  // Use defaults
 *       },
 *     }),
 *   ],
 * });
 * ```
 */

import { z } from "zod";
import { createMiddleware } from "../create-middleware";
import { createLogger } from "@journey/logger";
import { generateId } from "../utils";
import type { ToolCallRequest, ToolCallResponse } from "../types";

const log = createLogger("llm:middleware:hitl");

// ============================================================================
// Types
// ============================================================================

/**
 * Human decision on a tool call
 */
export type HITLDecision =
  | "approve"   // Allow tool call to proceed
  | "edit"      // Modify tool arguments before proceeding
  | "reject"    // Block tool call, return error to agent
  | "skip";     // Skip tool call silently (no error)

/**
 * Configuration for a single interrupt point
 */
export interface HITLInterruptConfig {
  /**
   * Decisions the human can make
   * @default ["approve", "reject"]
   */
  allowedDecisions?: HITLDecision[];

  /**
   * Description shown to human reviewer
   */
  description?: string;

  /**
   * Timeout in milliseconds to wait for human response
   * @default 300000 (5 minutes)
   */
  timeout?: number;

  /**
   * What to do if timeout is reached
   * @default "reject"
   */
  timeoutBehavior?: "approve" | "reject" | "skip";

  /**
   * Custom condition function to determine if this call should be interrupted
   * If not provided, all calls to this tool are interrupted
   */
  condition?: (args: unknown) => boolean;
}

/**
 * Configuration for HITL middleware
 */
export interface HITLMiddlewareConfig {
  /**
   * Tools that should trigger human-in-the-loop
   * Key is tool name, value is config or `true` for defaults
   */
  interruptOn: Record<string, HITLInterruptConfig | true>;

  /**
   * Callback to request human decision
   * This is the integration point for your UI/notification system.
   * Must return a promise that resolves with the human's decision.
   *
   * If not provided, middleware will emit events for external handling.
   */
  requestDecision?: (request: HITLRequest) => Promise<HITLResponse>;

  /**
   * Event emitter for HITL events (alternative to requestDecision callback)
   * Use this if you want to handle decisions asynchronously
   */
  eventHandler?: (event: HITLEvent) => void;

  /**
   * Global default timeout for all interrupts
   * @default 300000 (5 minutes)
   */
  defaultTimeout?: number;
}

/**
 * Request sent to human for decision
 */
export interface HITLRequest {
  /** Unique ID for this request */
  requestId: string;
  /** Tool being called */
  toolName: string;
  /** Arguments passed to tool */
  toolArgs: unknown;
  /** Tool call ID from model */
  toolCallId: string;
  /** Description from interrupt config */
  description?: string;
  /** Allowed decisions */
  allowedDecisions: HITLDecision[];
  /** When the request was created */
  createdAt: string;
  /** When the request will timeout */
  expiresAt: string;
}

/**
 * Response from human
 */
export interface HITLResponse {
  /** The decision made */
  decision: HITLDecision;
  /** Edited arguments (only for "edit" decision) */
  editedArgs?: Record<string, unknown>;
  /** Optional message/reason from human */
  message?: string;
}

/**
 * HITL event for external handling
 */
export interface HITLEvent {
  type: "interrupt" | "decision" | "timeout" | "resumed";
  requestId: string;
  toolName: string;
  toolArgs: unknown;
  decision?: HITLDecision;
  message?: string;
}

// ============================================================================
// State Schema
// ============================================================================

/**
 * State schema for HITL middleware
 */
const hitlStateSchema = z.object({
  /** Pending HITL requests awaiting decision */
  _mwHitlPending: z
    .array(
      z.object({
        requestId: z.string(),
        toolName: z.string(),
        toolArgs: z.unknown(),
        toolCallId: z.string(),
        createdAt: z.string(),
        expiresAt: z.string(),
      })
    )
    .default([]),

  /** History of HITL decisions for audit */
  _mwHitlHistory: z
    .array(
      z.object({
        requestId: z.string(),
        toolName: z.string(),
        decision: z.string(),
        decidedAt: z.string(),
        message: z.string().optional(),
      })
    )
    .default([]),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolved interrupt config with defaults applied
 */
interface ResolvedInterruptConfig {
  allowedDecisions: HITLDecision[];
  description?: string;
  timeout: number;
  timeoutBehavior: "approve" | "reject" | "skip";
  condition?: (args: unknown) => boolean;
}

/**
 * Get default config values
 */
function getInterruptConfig(
  config: HITLInterruptConfig | true
): ResolvedInterruptConfig {
  if (config === true) {
    return {
      allowedDecisions: ["approve", "reject"],
      description: undefined,
      timeout: 300000,
      timeoutBehavior: "reject",
      condition: undefined,
    };
  }

  return {
    allowedDecisions: config.allowedDecisions || ["approve", "reject"],
    description: config.description,
    timeout: config.timeout || 300000,
    timeoutBehavior: config.timeoutBehavior || "reject",
    condition: config.condition,
  };
}

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Create a Human-in-the-Loop middleware
 *
 * Intercepts specified tool calls and requires human approval before proceeding.
 * This provides a foundation for implementing review workflows in agent systems.
 *
 * **Integration Options:**
 *
 * 1. **Callback mode** (synchronous): Provide `requestDecision` callback that
 *    returns a Promise resolving with the human's decision. Good for simple
 *    integrations or when you can block.
 *
 * 2. **Event mode** (asynchronous): Provide `eventHandler` to receive events.
 *    You must implement separate logic to resume the agent with the decision.
 *    Good for long-running workflows with external approval systems.
 *
 * @param config - Configuration options
 *
 * @example Callback mode with custom UI
 * ```typescript
 * createHumanInTheLoopMiddleware({
 *   interruptOn: {
 *     "send_email": {
 *       allowedDecisions: ["approve", "edit", "reject"],
 *       description: "Review email content",
 *     },
 *   },
 *   requestDecision: async (request) => {
 *     // Show modal, wait for user input
 *     const result = await showApprovalModal(request);
 *     return result;
 *   },
 * })
 * ```
 *
 * @example Event mode for external systems
 * ```typescript
 * createHumanInTheLoopMiddleware({
 *   interruptOn: {
 *     "process_payment": true,
 *     "delete_account": {
 *       description: "Confirm account deletion",
 *       timeout: 600000, // 10 minutes
 *     },
 *   },
 *   eventHandler: (event) => {
 *     if (event.type === "interrupt") {
 *       // Send to Slack, email, or external approval system
 *       sendToApprovalQueue(event);
 *     }
 *   },
 * })
 * ```
 *
 * @example Conditional interrupts
 * ```typescript
 * createHumanInTheLoopMiddleware({
 *   interruptOn: {
 *     "transfer_funds": {
 *       // Only interrupt for amounts over $1000
 *       condition: (args) => (args.amount as number) > 1000,
 *       description: "Approve large transfer",
 *     },
 *   },
 * })
 * ```
 */
export function createHumanInTheLoopMiddleware(
  config: HITLMiddlewareConfig
): ReturnType<typeof createMiddleware> {
  const { interruptOn, requestDecision, eventHandler, defaultTimeout = 300000 } = config;

  if (Object.keys(interruptOn).length === 0) {
    throw new Error("HITLMiddleware requires at least one tool in interruptOn");
  }

  return createMiddleware({
    name: "HumanInTheLoopMiddleware",
    priority: 30, // Run last (innermost for tool wrapping)
    stateSchema: hitlStateSchema,

    wrapToolCall: async (
      request: ToolCallRequest,
      handler: (req: ToolCallRequest) => Promise<ToolCallResponse>
    ): Promise<ToolCallResponse> => {
      const interruptConfig = interruptOn[request.toolName];

      // No interrupt configured for this tool
      if (!interruptConfig) {
        return handler(request);
      }

      const config = getInterruptConfig(interruptConfig);

      // Check condition if provided
      if (config.condition && !config.condition(request.toolArgs)) {
        log.trace(
          { toolName: request.toolName },
          "middleware:hitl:conditionNotMet"
        );
        return handler(request);
      }

      // Create HITL request
      const now = new Date();
      const expiresAt = new Date(now.getTime() + config.timeout);

      const hitlRequest: HITLRequest = {
        requestId: generateId("hitl"),
        toolName: request.toolName,
        toolArgs: request.toolArgs,
        toolCallId: request.toolCallId,
        description: config.description,
        allowedDecisions: config.allowedDecisions,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      log.info(
        {
          requestId: hitlRequest.requestId,
          toolName: request.toolName,
          allowedDecisions: config.allowedDecisions,
        },
        "middleware:hitl:interrupted"
      );

      // Emit interrupt event
      if (eventHandler) {
        eventHandler({
          type: "interrupt",
          requestId: hitlRequest.requestId,
          toolName: request.toolName,
          toolArgs: request.toolArgs,
        });
      }

      // Get decision
      let response: HITLResponse;

      if (requestDecision) {
        // Callback mode - wait for decision
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("HITL timeout")), config.timeout);
          });

          response = await Promise.race([
            requestDecision(hitlRequest),
            timeoutPromise,
          ]);
        } catch (error) {
          // Timeout or error
          log.warn(
            { requestId: hitlRequest.requestId, toolName: request.toolName },
            "middleware:hitl:timeout"
          );

          if (eventHandler) {
            eventHandler({
              type: "timeout",
              requestId: hitlRequest.requestId,
              toolName: request.toolName,
              toolArgs: request.toolArgs,
            });
          }

          // Apply timeout behavior
          response = { decision: config.timeoutBehavior as HITLDecision };
        }
      } else {
        // No callback provided - reject by default
        // In a real implementation, this would pause and wait for external resume
        log.warn(
          { requestId: hitlRequest.requestId },
          "middleware:hitl:noCallback:defaultReject"
        );

        response = { decision: "reject", message: "No HITL handler configured" };
      }

      // Emit decision event
      if (eventHandler) {
        eventHandler({
          type: "decision",
          requestId: hitlRequest.requestId,
          toolName: request.toolName,
          toolArgs: request.toolArgs,
          decision: response.decision,
          message: response.message,
        });
      }

      log.info(
        {
          requestId: hitlRequest.requestId,
          toolName: request.toolName,
          decision: response.decision,
        },
        "middleware:hitl:decided"
      );

      // Apply decision
      switch (response.decision) {
        case "approve":
          // Proceed with original tool call
          return handler(request);

        case "edit":
          // Proceed with edited arguments
          if (response.editedArgs) {
            const editedRequest: ToolCallRequest = {
              ...request,
              toolArgs: response.editedArgs,
            };
            return handler(editedRequest);
          }
          // No edits provided, treat as approve
          return handler(request);

        case "reject":
          // Return error to agent
          return {
            result: null,
            error: new Error(
              response.message ||
                `Tool call "${request.toolName}" was rejected by human reviewer`
            ),
          };

        case "skip":
          // Skip silently - return empty success
          return {
            result: { skipped: true, reason: response.message || "Skipped by reviewer" },
            skipMessage: true,
          };

        default:
          // Unknown decision - reject for safety
          return {
            result: null,
            error: new Error(`Unknown HITL decision: ${response.decision}`),
          };
      }
    },
  });
}
