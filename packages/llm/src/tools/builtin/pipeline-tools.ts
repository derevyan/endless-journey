/**
 * Pipeline/CRM Management Tools
 *
 * Tools for managing user position in CRM pipelines:
 * - move_to_pipeline_stage: Move user to a specific pipeline/stage
 * - get_pipeline_position: Get user's current pipeline position
 *
 * @module tools/builtin/pipeline-tools
 */

import { serializeError } from "@journey/logger";
import type { AgentTool } from "@journey/schemas";
import { z } from "zod";
import type { BuiltinToolContext, ToolFactory } from "./types";
import { defaultServiceRetryConfig } from "./types";
import { SYSTEM_TOOL_NAMES } from "../unified/tool-names";

// =============================================================================
// MOVE TO PIPELINE STAGE TOOL
// =============================================================================

/**
 * Create move_to_pipeline_stage tool
 *
 * Moves the current user to a specific pipeline stage.
 */
export const createMoveToPipelineStageTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.MOVE_TO_PIPELINE_STAGE,
    description: "Move the current user to a specific pipeline stage. If user is not in the pipeline, they will be added. Useful for CRM workflow automation.",
    schema: z
      .object({
        pipelineId: z.string().optional().describe("Pipeline ID or slug (uses default pipeline if not specified)"),
        stageId: z.string().optional().describe("Stage ID or slug to move to (uses default stage if not specified)"),
        notes: z.string().optional().describe("Optional notes to add to the activity log"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      crm: { write: true },
      actions: ["crmWrite"],
    },
    // Deferred by default - fire-and-forget CRM action
    timingConfig: {
      timing: "deferred",
      configurable: true,
    },
    execute: async ({ pipelineId, stageId, notes }) => {
      if (!context.services.crm) {
        context.log.warn({ pipelineId, stageId }, "agent:tool:moveToPipelineStage:serviceNotAvailable");
        return { error: "Not available", message: "CRM service is not configured" };
      }

      const clientId = context.clientData?.id ?? context.session.userId;
      if (!clientId) {
        context.log.warn({}, "agent:tool:moveToPipelineStage:noClientId");
        return { error: "No client", message: "Cannot determine client ID" };
      }

      try {
        await context.services.crm.updateClientPosition(clientId, pipelineId, stageId, notes);
        context.log.debug({ clientId, pipelineId, stageId }, "agent:tool:moveToPipelineStage:success");
        return { success: true, clientId, pipelineId, stageId };
      } catch (error) {
        context.log.error({ err: serializeError(error), pipelineId, stageId }, "agent:tool:moveToPipelineStage:failed");
        return { error: "Move failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// GET PIPELINE POSITION TOOL
// =============================================================================

/**
 * Create get_pipeline_position tool
 *
 * Gets the current user's position in a specific pipeline or all pipelines.
 */
export const createGetPipelinePositionTool: ToolFactory = (context) => {
  return {
    name: SYSTEM_TOOL_NAMES.GET_PIPELINE_POSITION,
    description: "Get the current user's position in a specific pipeline or all pipelines.",
    schema: z
      .object({
        pipelineId: z.string().optional().describe("Pipeline ID to check (returns all pipelines if not specified)"),
      })
      .loose(),
    retry: defaultServiceRetryConfig,
    capabilities: {
      crm: { read: true },
      actions: ["crmRead"],
    },
    // Fixed immediate - LLM needs position info
    timingConfig: {
      timing: "immediate",
      configurable: false,
      fixedReason: "LLM needs position info",
    },
    execute: async ({ pipelineId }) => {
      if (!context.services.crm) {
        context.log.warn({ pipelineId }, "agent:tool:getPipelinePosition:serviceNotAvailable");
        return { error: "Not available", message: "CRM service is not configured" };
      }

      const clientId = context.clientData?.id ?? context.session.userId;
      if (!clientId) {
        context.log.warn({}, "agent:tool:getPipelinePosition:noClientId");
        return { error: "No client", message: "Cannot determine client ID" };
      }

      try {
        if (pipelineId && context.services.crm.getUserPipeline) {
          const position = await context.services.crm.getUserPipeline(clientId, pipelineId);
          context.log.debug({ clientId, pipelineId, found: !!position }, "agent:tool:getPipelinePosition:success");
          return position ?? { notInPipeline: true, pipelineId };
        }

        if (context.services.crm.getUserPipelines) {
          const positions = await context.services.crm.getUserPipelines(clientId);
          context.log.debug({ clientId, count: positions.length }, "agent:tool:getPipelinePosition:success");
          return { positions };
        }

        return { error: "Not supported", message: "Pipeline position query not available" };
      } catch (error) {
        context.log.error({ err: serializeError(error), pipelineId }, "agent:tool:getPipelinePosition:failed");
        return { error: "Query failed", message: String(error) };
      }
    },
  };
};

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Build all pipeline tools based on configuration
 *
 * @param context - Built-in tool context
 * @param config - Which tools to enable
 * @returns Array of enabled pipeline tools
 */
export function buildPipelineTools(
  context: BuiltinToolContext,
  config: {
    moveToPipelineStage?: boolean;
    getPipelinePosition?: boolean;
  }
): AgentTool[] {
  const tools: AgentTool[] = [];

  if (config.moveToPipelineStage) {
    tools.push(createMoveToPipelineStageTool(context));
  }
  if (config.getPipelinePosition) {
    tools.push(createGetPipelinePositionTool(context));
  }

  return tools;
}
