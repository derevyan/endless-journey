/**
 * Context Node Executor - KB/Memory/RAG injection
 *
 * Injects relevant context from various sources into the workflow.
 */

import { NotImplementedError, type ContextNodeConfig, type ContextSource } from "@journey/schemas";
import type { NodeInput, NodeOutput, WorkflowContext } from "../../types";
import { BaseNodeExecutor } from "../base-executor";

/**
 * Context node executor.
 *
 * Injects context from various sources:
 * - Memory: User/session memories
 * - Knowledge Base: Document chunks
 * - RAG: Semantic search results
 */
export class ContextNodeExecutor extends BaseNodeExecutor<ContextNodeConfig> {
  readonly nodeType = "context";

  protected async executeNode(
    input: NodeInput,
    config: ContextNodeConfig,
    context: WorkflowContext
  ): Promise<NodeOutput> {
    context.log.info({ sourceCount: config.sources.length }, "workflow:context:loading");

    const injectedContext: Record<string, unknown> = {};
    const metadata: Record<string, unknown> = {};

    // Process each source
    for (const source of config.sources) {
      const sourceResult = await this.processSource(source, input, context);

      // Merge results
      Object.assign(injectedContext, sourceResult.data);
      Object.assign(metadata, sourceResult.metadata);
    }

    return {
      outHandle: "default",
      data: {
        context: injectedContext,
        ...(config.outputVariable ? { [config.outputVariable]: injectedContext } : {}),
      },
      executionTimeMs: 0,
      metadata,
    };
  }

  private async processSource(
    source: ContextSource,
    input: NodeInput,
    context: WorkflowContext
  ): Promise<{ data: Record<string, unknown>; metadata: Record<string, unknown> }> {
    switch (source.type) {
      case "memory": {
        // Context node is experimental and not yet implemented
        context.log.warn({ type: "memory", maxResults: source.maxResults }, "workflow:context:source:not-implemented");

        throw new NotImplementedError(
          "context-memory",
          `Context node is experimental and not yet implemented. Source 'memory' is not available.`
        );
      }

      case "knowledge_base": {
        // Context node is experimental and not yet implemented
        context.log.warn({ type: "knowledge_base", kbId: source.kbId }, "workflow:context:source:not-implemented");

        throw new NotImplementedError(
          "context-knowledge-base",
          `Context node is experimental and not yet implemented. Source 'knowledge_base' is not available.`
        );
      }

      case "rag": {
        // Context node is experimental and not yet implemented
        context.log.warn({ type: "rag", indexId: source.indexId }, "workflow:context:source:not-implemented");

        throw new NotImplementedError(
          "context-rag",
          `Context node is experimental and not yet implemented. Source 'rag' is not available.`
        );
      }

      default: {
        const _exhaustive: never = source;
        throw new Error(`Unknown context source type: ${(_exhaustive as ContextSource).type}`);
      }
    }
  }
}
