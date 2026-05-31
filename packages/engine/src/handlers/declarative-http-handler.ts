import { createLogger, serializeError } from "@journey/logger";
import type { HttpNodeConfig, HttpOperationConfig, HttpRetryConfig } from "@journey/schemas";

import type { ExecutionContext, HandlerResult, HttpRequestConfig, HttpResponseData } from "../types";
import { getOrBuildEvaluationContext, storeNodeOutput } from "../utils";

const log = createLogger("declarative-http-handler");

export interface HttpNodeDataShape {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  retryCount?: number;
  errorHandling?: string;
  maxResponseBytes?: number;
}

export interface DeclarativeHttpRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  operation: HttpOperationConfig;
}

export interface DeclarativeHttpResponse extends HttpResponseData {
  durationMs: number;
}

export interface DeclarativeHttpHandler {
  resolveRequest: (nodeData: HttpNodeDataShape) => DeclarativeHttpRequest;
  executeRequest: (
    context: ExecutionContext,
    nodeData: HttpNodeDataShape,
    evalContext?: Record<string, unknown>
  ) => Promise<DeclarativeHttpResponse>;
  execute: (context: ExecutionContext) => Promise<HandlerResult>;
}

export function createDeclarativeHttpHandler(nodeType: string, config: HttpNodeConfig): DeclarativeHttpHandler {
  function resolveRequest(nodeData: HttpNodeDataShape): DeclarativeHttpRequest {
    const requestedMethod = (nodeData.method || "GET").toUpperCase();
    const operation = config.operations[requestedMethod];

    if (!operation) {
      log.error({ nodeType, method: requestedMethod }, "http:unknownOperation");
      throw new Error(`Unknown HTTP operation: ${requestedMethod}`);
    }

    const mergedHeaders = {
      ...config.defaultHeaders,
      ...operation.defaultHeaders,
      ...nodeData.headers,
    };
    const headers = Object.keys(mergedHeaders).length > 0 ? mergedHeaders : undefined;
    const body = operation.bodyAllowed ? nodeData.body : undefined;
    const timeoutMs = nodeData.timeoutMs ?? operation.timeout ?? config.defaultTimeout;
    const url = config.baseUrl ? `${config.baseUrl}${nodeData.url}` : nodeData.url;

    return {
      method: operation.method,
      url,
      headers,
      body,
      timeoutMs,
      operation,
    };
  }

  function resolveRetryConfig(nodeData: HttpNodeDataShape): HttpRetryConfig | undefined {
    const baseConfig = config.retryConfig;
    if (!baseConfig) return undefined;

    const retryCount = typeof nodeData.retryCount === "number" ? nodeData.retryCount : baseConfig.maxRetries;
    const shouldRetry = nodeData.errorHandling ? nodeData.errorHandling === "retry" : true;

    return {
      ...baseConfig,
      maxRetries: shouldRetry ? retryCount : 0,
    };
  }

  async function executeRequest(
    context: ExecutionContext,
    nodeData: HttpNodeDataShape,
    evalContext?: Record<string, unknown>
  ): Promise<DeclarativeHttpResponse> {
    const resolvedRequest = resolveRequest(nodeData);
    const evaluationContext = evalContext ?? await getOrBuildEvaluationContext(context);
    const startTime = Date.now();
    const retryConfig = resolveRetryConfig(nodeData);

    const request: HttpRequestConfig = {
      url: resolvedRequest.url,
      method: resolvedRequest.method,
      headers: resolvedRequest.headers,
      body: resolvedRequest.body,
      timeoutMs: resolvedRequest.timeoutMs,
      maxResponseBytes: nodeData.maxResponseBytes,
    };

    const response = await context.services.webhookExecutor.executeRequest(request, evaluationContext, retryConfig);

    return {
      ...response,
      durationMs: Date.now() - startTime,
    };
  }

  async function execute(context: ExecutionContext): Promise<HandlerResult> {
    const nodeData = context.node.data as HttpNodeDataShape;

    try {
      const response = await executeRequest(context, nodeData);
      storeNodeOutput(
        context.session,
        context.node,
        {
          statusCode: response.statusCode,
          body: response.body,
          headers: response.headers,
        },
        context.stateManager
      );

      context.log.info(
        {
          nodeId: context.node.id,
          nodeType,
          statusCode: response.statusCode,
          durationMs: response.durationMs,
        },
        "http:requestComplete"
      );

      const outgoingEdge = context.outgoingEdges[0];
      if (outgoingEdge) {
        return {
          action: "transition",
          targetNodeId: outgoingEdge.target,
          trigger: "http-complete",
        };
      }

      return { action: "complete" };
    } catch (error) {
      context.log.error(
        {
          nodeId: context.node.id,
          nodeType,
          err: serializeError(error),
        },
        "http:requestFailed"
      );
      throw error;
    }
  }

  return { resolveRequest, executeRequest, execute };
}
