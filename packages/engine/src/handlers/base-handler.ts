/**
 * Base Node Handler
 *
 * Provides consistent timing + logging for journey node execution.
 */

import { serializeError } from "@journey/logger";
import type { JourneyStepData, NodeType } from "@journey/schemas";

import type { ExecutionContext, HandlerResult, JourneyEvent, NodeEventResult, NodeHandler } from "../types";

export abstract class BaseNodeHandler<TData extends JourneyStepData = JourneyStepData> implements NodeHandler {
  abstract readonly nodeType: NodeType;

  async execute(context: ExecutionContext): Promise<HandlerResult> {
    const startTime = Date.now();
    const { node, log } = context;

    log.info({ nodeId: node.id, nodeType: this.nodeType }, `journey:${this.nodeType}:start`);

    try {
      const result = await this.executeNode(context);
      const executionTimeMs = Date.now() - startTime;

      log.info(
        {
          nodeId: node.id,
          nodeType: this.nodeType,
          executionTimeMs,
          action: result.action,
        },
        `journey:${this.nodeType}:complete`
      );

      return result;
    } catch (error) {
      log.error(
        {
          nodeId: node.id,
          nodeType: this.nodeType,
          err: serializeError(error),
        },
        `journey:${this.nodeType}:error`
      );
      throw error;
    }
  }

  protected abstract executeNode(context: ExecutionContext): Promise<HandlerResult>;

  // Optional event handling (default: no-op)
  async handleEvent(_event: JourneyEvent, _context: ExecutionContext): Promise<NodeEventResult | null> {
    return null;
  }
}
