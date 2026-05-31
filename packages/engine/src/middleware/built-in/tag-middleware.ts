/**
 * Tag Middleware
 *
 * Processes tag add/remove operations configured on journey nodes.
 * Runs after the node handler completes to apply tag changes.
 */

import { createLogger, serializeError } from "@journey/logger";
import { EventTypes, type TagAction } from "@journey/schemas";
import type { Middleware, MiddlewareDefinition } from "../types";
import { MIDDLEWARE_PRIORITIES } from "../priorities";

const log = createLogger("tag-middleware");

/**
 * Tag middleware factory
 *
 * Creates a middleware that processes tag add/remove operations.
 * Tag operations are non-blocking - errors are logged but don't stop the pipeline.
 */
export function createTagMiddleware(): Middleware {
  return async (node, context, _result, next) => {
    const { services, session } = context;

    // Null check: node.data may be undefined
    if (!node.data) {
      log.trace({ nodeId: node.id }, "tagMiddleware:skip:noNodeData");
      await next();
      return;
    }

    const tagAction = node.data.tagAction as TagAction | undefined;

    if (!tagAction) {
      log.trace({ nodeId: node.id }, "tagMiddleware:skip:noTagAction");
      await next();
      return;
    }

    const tags = tagAction.tags;
    if (!tags) {
      log.trace({ nodeId: node.id }, "tagMiddleware:skip:noTags");
      await next();
      return;
    }

    const hasAdd = tags.add && tags.add.length > 0;
    const hasRemove = tags.remove && tags.remove.length > 0;

    if (!hasAdd && !hasRemove) {
      log.trace({ nodeId: node.id }, "tagMiddleware:skip:emptyOperations");
      await next();
      return;
    }

    // Process tags
    try {
      await services.tag.executeTagAction(tags.add, tags.remove);
      const opCount = (tags.add?.length || 0) + (tags.remove?.length || 0);

      // Log tag event for simulator console
      services.eventLogger.logEvent({
        type: EventTypes.SESSION_TAGS,
        nodeId: node.id,
        payload: {
          addTags: tags.add,
          removeTags: tags.remove,
          operationCount: opCount,
          resultTags: session.tags,
        },
      });
    } catch (error) {
      log.error({ err: serializeError(error), nodeId: node.id }, "tagMiddleware:error");
      // Tag errors are non-blocking - continue pipeline
    }

    await next();
  };
}

/**
 * Tag middleware definition with default priority
 *
 * Priority 20: Core processing (runs early in the pipeline)
 */
export const tagMiddlewareDefinition: MiddlewareDefinition = {
  name: "tag",
  middleware: createTagMiddleware(),
  priority: MIDDLEWARE_PRIORITIES.TAGS,
};
