/**
 * Webhook Node Handler
 *
 * Handles webhook nodes - makes HTTP requests to external APIs.
 * Supports real requests, mock responses, retries, and response extraction.
 */

import { serializeError } from "@journey/logger";
import { EventTypes, type HttpNodeConfig, type JourneyEdgeData, type WebhookNodeData } from "@journey/schemas";
import type { ActivationContext } from "../../../lifecycle/types";
import type { ExecutionContext, HandlerResult } from "../../../types";
import { EdgeSelector, type EdgeSelectionResult } from "../../../services/edge-selector";
import { assertNodeData, getOrBuildEvaluationContext, maskUrl, storeNodeOutput } from "../../../utils";
import { BaseNodeHandler } from "../../base-handler";
import { createDeclarativeHttpHandler } from "../../declarative-http-handler";

const webhookHttpConfig: HttpNodeConfig = {
  operations: {
    GET: {
      method: "GET",
      bodyAllowed: false,
    },
    POST: {
      method: "POST",
      bodyAllowed: true,
      bodyFormat: "json",
    },
    PUT: {
      method: "PUT",
      bodyAllowed: true,
      bodyFormat: "json",
    },
    PATCH: {
      method: "PATCH",
      bodyAllowed: true,
      bodyFormat: "json",
    },
    DELETE: {
      method: "DELETE",
      bodyAllowed: false,
    },
  },
  defaultTimeout: 30000,
  defaultHeaders: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  retryConfig: {
    maxRetries: 3,
    backoffMs: 1000,
    retryOn: [502, 503, 504],
  },
};

const declarativeHttp = createDeclarativeHttpHandler("webhook", webhookHttpConfig);

/**
 * Select passable edges using full evaluation context
 *
 * Builds async context (vars.*, nodes.*, etc.) and filters edges by guards.
 * Used for both success and error paths to determine valid transitions.
 *
 * @param context - Execution context with session, services, etc.
 * @param edges - Outgoing edges to filter
 * @returns Selection result with passable edges
 */
async function selectPassableEdges(context: ExecutionContext, edges: JourneyEdgeData[]): Promise<EdgeSelectionResult> {
  const selector = await EdgeSelector.from(context).withFullContext();
  return selector.select(edges);
}

/**
 * Handler for webhook nodes
 *
 * Responsibilities:
 * - Build evaluation context for template substitution
 * - Delegate HTTP execution to webhook executor service
 * - Store response in session context if configured
 * - Handle success and error paths
 * - Log webhook events for observability
 */
export class WebhookNodeHandler extends BaseNodeHandler<WebhookNodeData> {
  readonly nodeType = "webhook" as const;

  protected async executeNode(context: ExecutionContext): Promise<HandlerResult> {
    const { session, node, outgoingEdges, services, log, stateManager } = context;
    const webhookData = assertNodeData<WebhookNodeData>(node, "webhook");

    // Build full evaluation context with namespaced bindings (cached per node execution)
    let evalContext: Record<string, unknown>;
    try {
      evalContext = await getOrBuildEvaluationContext(context);
    } catch (error) {
      log.error({ nodeId: node.id, err: serializeError(error) }, "webhook:variableFetchError");
      // Fail fast if context cannot be built - executing with partial context is dangerous
      throw new Error(`Failed to load variables for webhook context: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Track execution timing for observability
    const startTime = Date.now();
    let resolvedRequest: ReturnType<typeof declarativeHttp.resolveRequest> | null = null;

    try {
      resolvedRequest = declarativeHttp.resolveRequest(webhookData);
      const normalizedWebhookData: WebhookNodeData = {
        ...webhookData,
        url: resolvedRequest.url,
        method: resolvedRequest.method as WebhookNodeData["method"],
        headers: resolvedRequest.headers,
        body: resolvedRequest.body,
        timeoutMs: resolvedRequest.timeoutMs,
      };

      // Execute webhook
      const result = await services.webhookExecutor.execute(normalizedWebhookData, evalContext);

      // Calculate response size for logging (approximate)
      const responseSize = result ? JSON.stringify(result).length : 0;
      const durationMs = Date.now() - startTime;

      // Log successful webhook execution for observability
      log.info(
        {
          nodeId: node.id,
          webhookUrl: maskUrl(resolvedRequest.url),
          method: resolvedRequest.method,
          durationMs,
          responseSize,
          isMock: normalizedWebhookData.mockResponse?.enabled ?? false,
        },
        "webhook:success"
      );

      // Log webhook execution event for activity timeline
      services.eventLogger.logEvent({
        type: EventTypes.WEBHOOK_EXECUTED,
        nodeId: node.id,
        payload: {
          webhookUrl: maskUrl(resolvedRequest.url),
          method: resolvedRequest.method,
          label: webhookData.label,
          durationMs,
          isMock: normalizedWebhookData.mockResponse?.enabled ?? false,
        },
      });

      // Store as node output (for cross-node references via {{nodes.Label.field}})
      storeNodeOutput(session, node, result, stateManager);

      // Filter edges by guards (Smart Edges feature)
      const { passableEdges } = await selectPassableEdges(context, outgoingEdges);

      // Transition to success edge or first available edge
      if (passableEdges.length > 0) {
        const successEdge = passableEdges.find((e) => e.edgeType === "success") || passableEdges[0];
        return {
          action: "transition",
          targetNodeId: successEdge.target,
          trigger: "webhook_success",
        };
      }

      return { action: "wait" };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorHandling = webhookData.errorHandling || "continue";
      const requestUrl = resolvedRequest?.url ?? webhookData.url;
      const requestMethod = resolvedRequest?.method ?? webhookData.method;

      // Use appropriate log level based on error handling strategy
      const logMethod = errorHandling === "fail" ? log.error : log.warn;
      logMethod.call(log, { nodeId: node.id, err: serializeError(error), errorHandling, durationMs }, "webhook:error");

      // Log webhook error event (with masked URL to prevent leaking secrets in query params)
      const errorMessage = error instanceof Error ? error.message : String(error);
      services.eventLogger.logEvent({
        type: EventTypes.ENGINE_ERROR,
        nodeId: node.id,
        payload: {
          message: errorMessage,
          webhookUrl: maskUrl(requestUrl),
          method: requestMethod,
          error: errorMessage,
          errorHandling,
        },
      });

      if (errorHandling === "fail") {
        // Mark session as dropped via state manager
        stateManager.setStatus("dropped");
        return { action: "complete" };
      }

      // For "continue" and "retry" (retry exhausted), proceed to next node
      // Filter edges by guards - guards may differ for error paths
      const { passableEdges } = await selectPassableEdges(context, outgoingEdges);

      if (passableEdges.length > 0) {
        const errorEdge = passableEdges.find((e) => e.edgeType === "retry" || e.label?.toLowerCase().includes("error"));
        const targetEdge = errorEdge || passableEdges[0];
        return {
          action: "transition",
          targetNodeId: targetEdge.target,
          trigger: "webhook_error",
        };
      }

      return { action: "wait" };
    }
  }

  async onActivate(context: ActivationContext): Promise<void> {
    const { node, log } = context;
    const nodeData = assertNodeData<WebhookNodeData>(node, "webhook");

    log.debug(
      { nodeId: node.id, webhookUrl: maskUrl(nodeData.url) },
      "webhook:activated"
    );
  }

  async onDeactivate(context: ActivationContext): Promise<void> {
    const { node, log } = context;
    const nodeData = assertNodeData<WebhookNodeData>(node, "webhook");

    log.debug(
      { nodeId: node.id, webhookUrl: maskUrl(nodeData.url) },
      "webhook:deactivated"
    );
  }
}

export const webhookHandler = new WebhookNodeHandler();
