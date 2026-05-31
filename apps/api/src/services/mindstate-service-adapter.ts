/**
 * Mindstate Service Adapter
 *
 * Adapts the API's mindstate services to the engine's MindstateService interface.
 * This allows the SessionEngine to use mindstate analysis during journey execution.
 *
 * @module services/mindstate-service-adapter
 */

import type { MindstateService, MindstateAnalysisResult } from "@journey/engine";
import type { IApiMindstateService, StateParameterValue } from "@journey/schemas";
import { NotImplementedError } from "@journey/schemas";
import { createLogger, serializeError } from "@journey/logger";

const log = createLogger("mindstate-service-adapter");

/**
 * Creates a MindstateService adapter scoped to an organization.
 *
 * The adapter wraps the existing mindstate API services to match
 * the engine's MindstateService interface, allowing mindstate
 * analysis to be triggered automatically during journey execution.
 *
 * @param organizationId - Organization ID for multi-tenancy
 * @returns MindstateService implementation
 *
 * @example
 * ```typescript
 * const mindstateService = createMindstateServiceAdapter(apiMindstateService, organizationId);
 * const engine = new SessionEngine(session, journey, adapter, {
 *   mindstateService,
 *   mindstateConfig,
 * });
 * ```
 */
export function createMindstateServiceAdapter(
  service: IApiMindstateService,
  organizationId?: string
): MindstateService {
  return {
    /**
     * Get or create a mindstate instance for a client
     */
    async getOrCreateMindstate(clientId: string, mindstateKey: string) {
      try {
        log.debug({ clientId, mindstateKey, organizationId }, "mindstateAdapter:getOrCreateMindstate");
        return await service.getOrCreateClientMindstate(clientId, mindstateKey);
      } catch (error) {
        log.error(
          { clientId, mindstateKey, organizationId, err: serializeError(error) },
          "mindstateAdapter:getOrCreateMindstate:error"
        );
        throw error;
      }
    },

    /**
     * Analyze a user message and update mindstate
     */
    async analyzeMessage(clientMindstateId: string, message: string, sessionId?: string): Promise<MindstateAnalysisResult> {
      try {
        log.debug({ clientMindstateId, sessionId, messageLength: message.length }, "mindstateAdapter:analyzeMessage");

        const result = await service.analyzeMessage(clientMindstateId, message, "message", sessionId);

        // Map API's AnalysisResult to engine's MindstateAnalysisResult
        // API: { mindstateId, changes, newInsights, metrics, responseMessage }
        // Engine: { updatedState, changes, metrics }
        return {
          updatedState: [], // Engine's MindstateAnalyzer tracks state internally
          changes: result.changes || [],
          metrics: result.metrics,
        };
      } catch (error) {
        log.error(
          { clientMindstateId, sessionId, organizationId, err: serializeError(error) },
          "mindstateAdapter:analyzeMessage:error"
        );
        throw error;
      }
    },

    /**
     * Get a single parameter value
     */
    async getParameterValue(clientId: string, mindstateKey: string, parameterName: string): Promise<StateParameterValue | null> {
      try {
        log.debug({ clientId, mindstateKey, parameterName, organizationId }, "mindstateAdapter:getParameterValue");
        return await service.getParameterValue(clientId, mindstateKey, parameterName);
      } catch (error) {
        log.error(
          { clientId, mindstateKey, parameterName, organizationId, err: serializeError(error) },
          "mindstateAdapter:getParameterValue:error"
        );
        throw error;
      }
    },

    /**
     * Get multiple parameter values in batch
     */
    async getMultipleParameterValues(
      clientId: string,
      queries: Array<{ mindstateKey: string; parameterName: string }>
    ): Promise<Map<string, StateParameterValue>> {
      try {
        log.debug({ clientId, queryCount: queries.length, organizationId }, "mindstateAdapter:getMultipleParameterValues");
        return await service.getParameterValues(clientId, queries);
      } catch (error) {
        log.error(
          { clientId, queryCount: queries.length, organizationId, err: serializeError(error) },
          "mindstateAdapter:getMultipleParameterValues:error"
        );
        throw error;
      }
    },

    /**
     * Set a parameter value manually
     * @throws Error - Not yet implemented
     */
    async setParameterValue(
      clientId: string,
      mindstateKey: string,
      parameterName: string,
      _value: StateParameterValue,
      _reasoning?: string
    ): Promise<void> {
      log.warn({ clientId, mindstateKey, parameterName, organizationId }, "mindstateAdapter:setParameterValue:notImplemented");
      throw new NotImplementedError("setParameterValue in mindstate service adapter");
    },
  };
}
