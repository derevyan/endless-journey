/**
 * MCP Node Executor - External MCP tool calls
 *
 * Executes tools from configured MCP servers via the MCP service.
 * Supports variable templates in parameters and configurable error handling.
 *
 * Output handles:
 * - 'success': Tool executed successfully, result in data.mcp_result
 * - 'error': Tool failed (only with onError: "continue"), error in data.mcp_error
 */

import type { MCPNodeConfig } from "@journey/schemas";
import { getMCPServiceClient } from "@journey/mcp";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { resolveObjectTemplates } from "../../variable-resolver";
import { BaseNodeExecutor } from "../base-executor";

/**
 * MCP node executor.
 *
 * Calls external MCP server tools with support for:
 * - Variable templates in parameters ({{variable.path}})
 * - Retry logic based on onError config
 * - Graceful degradation when MCP service unavailable
 */
export class MCPNodeExecutor extends BaseNodeExecutor<MCPNodeConfig> {
  readonly nodeType = "mcp";

  protected async executeNode(
    input: NodeInput,
    config: MCPNodeConfig,
    context: WorkflowContext
  ): Promise<NodeOutput> {
    context.log.info(
      { server: config.server, tool: config.tool },
      "workflow:mcp:calling"
    );

    // Get MCP client
    const client = getMCPServiceClient();
    if (!client) {
      context.log.warn({}, "workflow:mcp:serviceUnavailable");
      return this.handleError(
        config,
        "MCP service not available",
        context
      );
    }

    // Resolve variable templates in params
    const variables = {
      ...input.variables,
      input: input.message,
      message: input.message,
    };
    const resolvedParams = resolveObjectTemplates(
      config.params as Record<string, unknown>,
      variables
    );

    // Build tool name in server_tool format
    const toolName = `${config.server}_${config.tool}`;

    context.log.debug(
      { toolName, params: resolvedParams },
      "workflow:mcp:resolved"
    );

    // Execute with retry logic
    let lastError: string | null = null;
    const maxAttempts = config.onError === "retry" ? config.maxRetries + 1 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await client.callTool({
          toolName,
          args: resolvedParams,
          options: {
            timeout: config.timeout,
          },
        });

        if (result.success) {
          context.log.info(
            {
              toolName,
              attempt,
              executionTimeMs: result.executionTimeMs,
            },
            "workflow:mcp:success"
          );

          return {
            outHandle: "success",
            data: { mcp_result: result.result },
            executionTimeMs: 0,
            metadata: {
              attempt,
              toolName,
              server: config.server,
              tool: config.tool,
              mcpExecutionTimeMs: result.executionTimeMs,
            },
          };
        } else {
          lastError = result.error?.message || "Tool execution failed";
          context.log.warn(
            { toolName, attempt, error: lastError, code: result.error?.code },
            "workflow:mcp:toolError"
          );
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        context.log.warn(
          { toolName, attempt, error: lastError },
          "workflow:mcp:callError"
        );
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxAttempts) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await this.delay(delayMs);
      }
    }

    // All attempts failed
    return this.handleError(
      config,
      lastError || "Unknown error",
      context,
      { toolName, attempts: maxAttempts }
    );
  }

  /**
   * Handle error based on onError configuration.
   */
  private handleError(
    config: MCPNodeConfig,
    errorMessage: string,
    context: WorkflowContext,
    metadata?: Record<string, unknown>
  ): NodeOutput {
    if (config.onError === "continue") {
      // Return via error edge, workflow continues
      context.log.info(
        { error: errorMessage },
        "workflow:mcp:continuingAfterError"
      );

      return {
        outHandle: "error",
        data: { mcp_error: errorMessage },
        executionTimeMs: 0,
        metadata: {
          ...metadata,
          errorHandling: "continue",
        },
      };
    }

    // "fail" or "retry" (after exhausted retries) - throw to stop workflow
    context.log.error(
      { error: errorMessage, ...metadata },
      "workflow:mcp:failed"
    );

    throw new Error(`MCP tool execution failed: ${errorMessage}`);
  }

  /**
   * Simple delay helper for retry backoff.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
