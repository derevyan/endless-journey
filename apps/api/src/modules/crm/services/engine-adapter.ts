/**
 * CRM Engine Adapter
 *
 * Adapts CRM stage service to the engine's CrmService interface.
 * Handles pipeline resolution and stage management for journey execution.
 *
 * @module modules/crm/services/engine-adapter
 */

import { createLogger, serializeError } from "@journey/logger";
import type { CrmService } from "@journey/engine";
import type { CrmOperationEventContext, IApiCrmService } from "@journey/schemas";

import type { IEventPublisher } from "../../../services/interfaces";
import { emitActionExecuted, emitActionFailed } from "./action-feedback";

const log = createLogger("crm-engine-adapter");

/**
 * Session context for journey-triggered CRM operations
 */
export interface CrmSessionContext {
  sessionId: string;
  journeyId: string;
  /** Organization ID for event publishing */
  organizationId: string;
  /** Client ID for event publishing */
  clientId: string;
  /** Node ID that triggered the CRM action (for feedback events) */
  nodeId?: string;
  /** Workflow ID if triggered from a workflow node */
  workflowId?: string;
}

/**
 * Create a CRM service adapter for the engine
 *
 * @param crmService - Organization-scoped CRM service
 * @param publisher - Event publisher for action feedback
 * @param sessionContext - Optional session context for journey-triggered operations
 * @returns CrmService implementation
 */
export function createCrmEngineAdapter(
  crmService: IApiCrmService,
  publisher: IEventPublisher,
  sessionContext?: CrmSessionContext
): CrmService {
  // Build operation context for event publishing
  const ctx: CrmOperationEventContext = sessionContext
    ? {
        triggeredBy: "journey",
        sessionId: sessionContext.sessionId,
        journeyId: sessionContext.journeyId,
      }
    : { triggeredBy: "manual" };
  const organizationId = sessionContext?.organizationId;
  return {
    /**
     * Update client's CRM position (simplified interface)
     *
     * Service determines whether to create or move based on current state:
     * - If client not in pipeline → add to pipeline at stage
     * - If client in pipeline → move to new stage
     *
     * Pipeline resolution:
     * 1. Use provided pipelineId if set
     * 2. Fall back to organization's default pipeline
     */
    async updateClientPosition(
      clientId: string,
      pipelineId?: string,
      stageId?: string,
      notes?: string
    ): Promise<void> {
      const startTime = Date.now();
      let resolvedPipelineId = pipelineId;
      let pipelineName: string | null = null;
      let stageName: string | null = null;

      try {
        // Resolve pipeline ID
        if (!resolvedPipelineId) {
          const defaultPipeline = await crmService.ensureDefaultPipeline();
          resolvedPipelineId = defaultPipeline.id;
          pipelineName = defaultPipeline.name;
        } else {
          const pipeline = await crmService.getPipeline(resolvedPipelineId);
          pipelineName = pipeline?.name ?? null;
        }

        // Resolve stage name if stageId provided
        if (stageId) {
          const stage = await crmService.getPipelineStageById(stageId);
          stageName = stage?.name ?? null;
        }

        // Check if client already has a stage in this pipeline
        const existingStage = await crmService.getClientStage(clientId, resolvedPipelineId);
        let result: "created" | "updated" | "no_change" = "no_change";

        if (stageId) {
          // Specific stage requested - assign to it
          await crmService.assignClientToStage(clientId, stageId, null, notes, ctx);
          result = existingStage ? "updated" : "created";
          log.info(
            { clientId, organizationId, pipelineId: resolvedPipelineId, stageId, wasNew: !existingStage },
            "crmEngineAdapter:updateClientPosition:success"
          );
        } else if (!existingStage) {
          // No specific stage, and not in pipeline - assign to default stage
          await crmService.assignClientToPipeline(clientId, resolvedPipelineId, notes);
          result = "created";
          log.info(
            { clientId, organizationId, pipelineId: resolvedPipelineId },
            "crmEngineAdapter:updateClientPosition:defaultStage"
          );
        } else {
          // Already in pipeline, no specific stage requested - nothing to do
          log.debug(
            { clientId, organizationId, pipelineId: resolvedPipelineId, existingStageId: existingStage.stageId },
            "crmEngineAdapter:updateClientPosition:noChange"
          );
        }

        // Emit success feedback event
        if (sessionContext?.nodeId) {
          await emitActionExecuted(
            publisher,
            {
              context: sessionContext,
              actionType: "update_position",
              pipelineId: resolvedPipelineId,
              pipelineName,
              stageId: stageId ?? null,
              stageName,
              startTime,
            },
            { result }
          );
        }
      } catch (error) {
        // Emit failure feedback event
        if (sessionContext?.nodeId) {
          await emitActionFailed(
            publisher,
            {
              context: sessionContext,
              actionType: "update_position",
              pipelineId: resolvedPipelineId ?? null,
              stageId: stageId ?? null,
              startTime,
            },
            {
              errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            }
          );
        }

        log.error(
          { clientId, organizationId, pipelineId, stageId, err: serializeError(error) },
          "crmEngineAdapter:updateClientPosition:error"
        );
        throw error;
      }
    },

    /**
     * Add client to a pipeline at the specified stage (or default stage)
     *
     * Pipeline resolution:
     * 1. Use provided pipelineId if set
     * 2. Fall back to organization's default pipeline
     */
    async addToPipeline(
      clientId: string,
      pipelineId?: string,
      stageId?: string,
      notes?: string
    ): Promise<void> {
      const startTime = Date.now();
      let resolvedPipelineId = pipelineId;
      let pipelineName: string | null = null;
      let stageName: string | null = null;

      try {
        // Resolve pipeline ID
        if (!resolvedPipelineId) {
          const defaultPipeline = await crmService.ensureDefaultPipeline();
          resolvedPipelineId = defaultPipeline.id;
          pipelineName = defaultPipeline.name;
        } else {
          const pipeline = await crmService.getPipeline(resolvedPipelineId);
          pipelineName = pipeline?.name ?? null;
        }

        // Resolve stage name if stageId provided
        if (stageId) {
          const stage = await crmService.getPipelineStageById(stageId);
          stageName = stage?.name ?? null;
        }

        let result: "created" | "no_change" = "created";

        // If stageId is provided, use it directly
        if (stageId) {
          // Check if client already has a stage in this pipeline
          const existingStage = await crmService.getClientStage(clientId, resolvedPipelineId);
          if (existingStage) {
            result = "no_change";
            log.debug(
              { clientId, organizationId, pipelineId: resolvedPipelineId, existingStageId: existingStage.stageId },
              "crmEngineAdapter:addToPipeline:alreadyExists"
            );
          } else {
            await crmService.assignClientToStage(clientId, stageId, null, notes, ctx);
            log.info(
              { clientId, organizationId, pipelineId: resolvedPipelineId, stageId },
              "crmEngineAdapter:addToPipeline:success"
            );
          }
        } else {
          // No stageId - assign to pipeline's default stage
          await crmService.assignClientToPipeline(clientId, resolvedPipelineId, notes);
          log.info(
            { clientId, organizationId, pipelineId: resolvedPipelineId },
            "crmEngineAdapter:addToPipeline:defaultStage"
          );
        }

        // Emit success feedback event
        if (sessionContext?.nodeId) {
          await emitActionExecuted(
            publisher,
            {
              context: sessionContext,
              actionType: "add_to_pipeline",
              pipelineId: resolvedPipelineId,
              pipelineName,
              stageId: stageId ?? null,
              stageName,
              startTime,
            },
            { result }
          );
        }
      } catch (error) {
        // Emit failure feedback event
        if (sessionContext?.nodeId) {
          await emitActionFailed(
            publisher,
            {
              context: sessionContext,
              actionType: "add_to_pipeline",
              pipelineId: resolvedPipelineId ?? null,
              stageId: stageId ?? null,
              startTime,
            },
            {
              errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            }
          );
        }

        log.error(
          { clientId, organizationId, pipelineId, stageId, err: serializeError(error) },
          "crmEngineAdapter:addToPipeline:error"
        );
        throw error;
      }
    },

    /**
     * Move client to a different stage
     */
    async moveToStage(clientId: string, stageId: string, notes?: string): Promise<void> {
      const startTime = Date.now();
      let pipelineId: string | null = null;
      let pipelineName: string | null = null;
      let stageName: string | null = null;

      try {
        // Get stage info for feedback event
        const stage = await crmService.getPipelineStageById(stageId);
        if (stage) {
          stageName = stage.name;
          pipelineId = stage.pipelineId;
          const pipeline = await crmService.getPipeline(stage.pipelineId);
          pipelineName = pipeline?.name ?? null;
        }

        await crmService.assignClientToStage(clientId, stageId, null, notes, ctx);
        log.info({ clientId, organizationId, stageId }, "crmEngineAdapter:moveToStage:success");

        // Emit success feedback event
        if (sessionContext?.nodeId) {
          await emitActionExecuted(
            publisher,
            {
              context: sessionContext,
              actionType: "move_to_stage",
              pipelineId,
              pipelineName,
              stageId,
              stageName,
              startTime,
            },
            { result: "updated" }
          );
        }
      } catch (error) {
        // Emit failure feedback event
        if (sessionContext?.nodeId) {
          await emitActionFailed(
            publisher,
            {
              context: sessionContext,
              actionType: "move_to_stage",
              pipelineId,
              stageId,
              startTime,
            },
            {
              errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            }
          );
        }

        log.error(
          { clientId, organizationId, stageId, err: serializeError(error) },
          "crmEngineAdapter:moveToStage:error"
        );
        throw error;
      }
    },

    /**
     * Remove client from a pipeline
     *
     * Deletes the client's stage assignment from the pipeline and logs the removal.
     */
    async removeFromPipeline(clientId: string, pipelineId: string): Promise<void> {
      const startTime = Date.now();
      let pipelineName: string | null = null;

      try {
        // Get pipeline name for feedback event
        const pipeline = await crmService.getPipeline(pipelineId);
        pipelineName = pipeline?.name ?? null;

        const removed = await crmService.removeClientFromPipeline(clientId, pipelineId, null, ctx);
        const result = removed ? "removed" : "no_change";

        if (removed) {
          log.info(
            { clientId, organizationId, pipelineId },
            "crmEngineAdapter:removeFromPipeline:success"
          );
        } else {
          log.debug(
            { clientId, organizationId, pipelineId },
            "crmEngineAdapter:removeFromPipeline:notInPipeline"
          );
        }

        // Emit success feedback event
        if (sessionContext?.nodeId) {
          await emitActionExecuted(
            publisher,
            {
              context: sessionContext,
              actionType: "remove_from_pipeline",
              pipelineId,
              pipelineName,
              stageId: null,
              stageName: null,
              startTime,
            },
            { result }
          );
        }
      } catch (error) {
        // Emit failure feedback event
        if (sessionContext?.nodeId) {
          await emitActionFailed(
            publisher,
            {
              context: sessionContext,
              actionType: "remove_from_pipeline",
              pipelineId,
              stageId: null,
              startTime,
            },
            {
              errorCode: error instanceof Error ? error.name : "UNKNOWN_ERROR",
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            }
          );
        }

        log.error(
          { clientId, organizationId, pipelineId, err: serializeError(error) },
          "crmEngineAdapter:removeFromPipeline:error"
        );
        throw error;
      }
    },
  };
}
