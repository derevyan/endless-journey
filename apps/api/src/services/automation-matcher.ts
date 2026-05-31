/**
 * Automation Matcher Service
 *
 * Finds automation triggers that match incoming events.
 * Uses indexed queries on the automation_triggers table.
 *
 * @module services/automation-matcher
 */

import { db } from "@journey/db";
import { automationTriggers, tagDefinitions, variables } from "@journey/db/schema";
import { evaluateExpressionSync } from "@journey/engine";
import { createLogger, serializeError } from "@journey/logger";
import { EventTypes, type BaseEvent } from "@journey/schemas";
import { and, eq, isNull, or } from "drizzle-orm";

const log = createLogger("automation-matcher");

// =============================================================================
// PAYLOAD VALIDATION
// =============================================================================

/**
 * Validate that a payload has required string fields
 * Logs warning and returns null if validation fails
 */
function validatePayloadFields<T extends string>(
  payload: Record<string, unknown> | null,
  fields: T[],
  eventType: string
): Record<T, string> | null {
  if (!payload) {
    log.warn({ eventType }, "automationMatcher:invalidPayload:null");
    return null;
  }

  const result = {} as Record<T, string>;

  for (const field of fields) {
    const value = payload[field];
    if (typeof value !== "string" || !value) {
      log.warn(
        { eventType, field, value },
        "automationMatcher:invalidPayload:missingField"
      );
      return null;
    }
    result[field] = value;
  }

  return result;
}

// =============================================================================
// TYPES
// =============================================================================

export interface MatchedTrigger {
  id: string;
  journeyId: string;
  organizationId: string;
  triggerType: string;
}

// =============================================================================
// EXPRESSION EVALUATION (Exported for testing)
// =============================================================================

/**
 * Evaluate an expression against a value using JEXL
 * Used for variable_condition triggers
 *
 * @param expression - Expression like "value >= 100" or "value == 'gold'"
 * @param value - The actual value to check
 * @returns true if expression evaluates to truthy
 *
 * @public Exported for unit testing
 */
export function evaluateExpression(expression: string | null, value: unknown): boolean {
  if (!expression) return false;

  try {
    // JEXL handles all types natively (numbers, strings, booleans, null, arrays, objects)
    const result = evaluateExpressionSync(expression, { value });
    return Boolean(result);
  } catch (error) {
    log.warn(
      { expression, value, err: serializeError(error) },
      "automationMatcher:expressionEvaluationFailed"
    );
    return false;
  }
}

// =============================================================================
// TRIGGER MATCHING
// =============================================================================

/**
 * Find all automation triggers that match an incoming event
 *
 * @param event - The automation event to match
 * @returns Array of matching triggers
 */
export async function findMatchingTriggers(event: BaseEvent): Promise<MatchedTrigger[]> {
  const payload = event.payload as Record<string, unknown> | null;

  try {
    switch (event.type) {
      case EventTypes.TAG_ADDED: {
        const validated = validatePayloadFields(payload, ["tagName"], event.type);
        if (!validated) return [];
        return findTagChangeTriggers(event.organizationId, validated.tagName, "added");
      }

      case EventTypes.TAG_REMOVED: {
        const validated = validatePayloadFields(payload, ["tagName"], event.type);
        if (!validated) return [];
        return findTagChangeTriggers(event.organizationId, validated.tagName, "removed");
      }

      case EventTypes.VARIABLE_CHANGED: {
        const validated = validatePayloadFields(payload, ["key", "scope"], event.type);
        if (!validated) return [];
        const scope = validated.scope as "user" | "journey" | "global";
        if (!["user", "journey", "global"].includes(scope)) {
          log.warn({ eventType: event.type, scope }, "automationMatcher:invalidPayload:invalidScope");
          return [];
        }
        return findVariableConditionTriggers(
          event.organizationId,
          validated.key,
          scope,
          payload?.value
        );
      }

      case EventTypes.JOURNEY_SESSION_COMPLETED:
        // Pass null explicitly when journeyId is missing - avoids incorrect matching
        return findJourneyCompletedTriggers(event.organizationId, event.journeyId ?? null);

      case EventTypes.JOURNEY_SCHEDULE_FIRED: {
        const validated = validatePayloadFields(payload, ["triggerId"], event.type);
        if (!validated) return [];
        return findTriggerById(validated.triggerId);
      }

      case EventTypes.JOURNEY_WEBHOOK_RECEIVED: {
        const validated = validatePayloadFields(payload, ["triggerId"], event.type);
        if (!validated) return [];
        return findTriggerById(validated.triggerId);
      }

      // CRM events for automation triggers
      case EventTypes.CRM_STAGE_CHANGED: {
        const validated = validatePayloadFields(payload, ["pipelineId", "toStageId"], event.type);
        if (!validated) return [];
        return findCrmStageChangeTriggers(
          event.organizationId,
          validated.pipelineId,
          validated.toStageId
        );
      }

      case EventTypes.CRM_PIPELINE_ENTERED: {
        const validated = validatePayloadFields(payload, ["pipelineId"], event.type);
        if (!validated) return [];
        return findCrmPipelineEnteredTriggers(event.organizationId, validated.pipelineId);
      }

      case EventTypes.CRM_FIELD_UPDATED: {
        const validated = validatePayloadFields(payload, ["fieldKey"], event.type);
        if (!validated) return [];
        return findCrmFieldChangeTriggers(
          event.organizationId,
          validated.fieldKey,
          payload?.newValue
        );
      }

      default:
        log.debug({ eventType: event.type }, "automationMatcher:noMatcherForEventType");
        return [];
    }
  } catch (error) {
    log.error(
      { eventType: event.type, err: serializeError(error) },
      "automationMatcher:findMatchingTriggers:error"
    );
    return [];
  }
}

/**
 * Find triggers for tag change events
 * Tags are global (organization-wide) - no scope filtering needed
 */
async function findTagChangeTriggers(
  organizationId: string,
  tagName: string,
  action: "added" | "removed"
): Promise<MatchedTrigger[]> {
  const results = await db
    .select({
      id: automationTriggers.id,
      journeyId: automationTriggers.journeyId,
      organizationId: automationTriggers.organizationId,
      triggerType: automationTriggers.triggerType,
    })
    .from(automationTriggers)
    .innerJoin(tagDefinitions, eq(automationTriggers.tagId, tagDefinitions.id))
    .where(
      and(
        eq(automationTriggers.organizationId, organizationId),
        eq(automationTriggers.triggerType, "tag_change"),
        eq(tagDefinitions.name, tagName),
        eq(automationTriggers.tagAction, action),
        eq(automationTriggers.isActive, true)
      )
    );

  log.debug(
    { organizationId, tagName, action, matchCount: results.length },
    "automationMatcher:tagChangeTriggers"
  );

  return results;
}

/**
 * Find triggers for variable condition events
 * Filters by expression evaluation
 */
async function findVariableConditionTriggers(
  organizationId: string,
  variableKey: string,
  scope: "user" | "journey" | "global",
  value: unknown
): Promise<MatchedTrigger[]> {
  // First, get all potential triggers for this variable
  const potentialTriggers = await db
    .select({
      id: automationTriggers.id,
      journeyId: automationTriggers.journeyId,
      organizationId: automationTriggers.organizationId,
      triggerType: automationTriggers.triggerType,
      expression: automationTriggers.expression,
    })
    .from(automationTriggers)
    .innerJoin(variables, eq(automationTriggers.variableId, variables.id))
    .where(
      and(
        eq(automationTriggers.organizationId, organizationId),
        eq(automationTriggers.triggerType, "variable_condition"),
        eq(variables.key, variableKey),
        eq(automationTriggers.variableScope, scope),
        eq(automationTriggers.isActive, true)
      )
    );

  // Then filter by expression evaluation
  const matchingTriggers = potentialTriggers.filter((trigger) =>
    evaluateExpression(trigger.expression, value)
  );

  log.debug(
    {
      organizationId,
      variableKey,
      scope,
      value,
      potentialCount: potentialTriggers.length,
      matchCount: matchingTriggers.length,
    },
    "automationMatcher:variableConditionTriggers"
  );

  return matchingTriggers.map(({ expression, ...rest }) => rest);
}

/**
 * Find triggers for journey completed events
 *
 * @param completedJourneyId - The ID of the completed journey, or null if unknown
 *   When null, only triggers with sourceJourneyId=NULL (any journey) are matched.
 *   When set, both specific journey triggers AND "any journey" triggers are matched.
 */
async function findJourneyCompletedTriggers(
  organizationId: string,
  completedJourneyId: string | null
): Promise<MatchedTrigger[]> {
  // Build source journey condition based on whether we have a specific journey ID
  const sourceJourneyCondition = completedJourneyId
    ? or(
        eq(automationTriggers.sourceJourneyId, completedJourneyId),
        isNull(automationTriggers.sourceJourneyId)
      )
    : isNull(automationTriggers.sourceJourneyId);

  const results = await db
    .select({
      id: automationTriggers.id,
      journeyId: automationTriggers.journeyId,
      organizationId: automationTriggers.organizationId,
      triggerType: automationTriggers.triggerType,
    })
    .from(automationTriggers)
    .where(
      and(
        eq(automationTriggers.organizationId, organizationId),
        eq(automationTriggers.triggerType, "journey_completed"),
        eq(automationTriggers.isActive, true),
        sourceJourneyCondition
      )
    );

  log.debug(
    { organizationId, completedJourneyId, matchCount: results.length },
    "automationMatcher:journeyCompletedTriggers"
  );

  return results;
}

/**
 * Find a specific trigger by ID
 * Used for schedule and webhook events that already know their trigger
 */
async function findTriggerById(triggerId: string): Promise<MatchedTrigger[]> {
  const results = await db
    .select({
      id: automationTriggers.id,
      journeyId: automationTriggers.journeyId,
      organizationId: automationTriggers.organizationId,
      triggerType: automationTriggers.triggerType,
    })
    .from(automationTriggers)
    .where(
      and(eq(automationTriggers.id, triggerId), eq(automationTriggers.isActive, true))
    );

  return results;
}

// =============================================================================
// CRM TRIGGER MATCHERS
// =============================================================================

/**
 * Find triggers for CRM stage change events
 */
async function findCrmStageChangeTriggers(
  organizationId: string,
  pipelineId: string,
  toStageId: string
): Promise<MatchedTrigger[]> {
  const results = await db
    .select({
      id: automationTriggers.id,
      journeyId: automationTriggers.journeyId,
      organizationId: automationTriggers.organizationId,
      triggerType: automationTriggers.triggerType,
    })
    .from(automationTriggers)
    .where(
      and(
        eq(automationTriggers.organizationId, organizationId),
        eq(automationTriggers.triggerType, "crm_stage_change"),
        eq(automationTriggers.isActive, true),
        or(
          // Match specific stage
          eq(automationTriggers.crmStageId, toStageId),
          // Or match any stage in this pipeline
          and(
            eq(automationTriggers.crmPipelineId, pipelineId),
            isNull(automationTriggers.crmStageId)
          )
        )
      )
    );

  log.debug(
    { organizationId, pipelineId, toStageId, matchCount: results.length },
    "automationMatcher:crmStageChangeTriggers"
  );

  return results;
}

/**
 * Find triggers for CRM pipeline entered events
 */
async function findCrmPipelineEnteredTriggers(
  organizationId: string,
  pipelineId: string
): Promise<MatchedTrigger[]> {
  const results = await db
    .select({
      id: automationTriggers.id,
      journeyId: automationTriggers.journeyId,
      organizationId: automationTriggers.organizationId,
      triggerType: automationTriggers.triggerType,
    })
    .from(automationTriggers)
    .where(
      and(
        eq(automationTriggers.organizationId, organizationId),
        eq(automationTriggers.triggerType, "crm_pipeline_entered"),
        eq(automationTriggers.crmPipelineId, pipelineId),
        eq(automationTriggers.isActive, true)
      )
    );

  log.debug(
    { organizationId, pipelineId, matchCount: results.length },
    "automationMatcher:crmPipelineEnteredTriggers"
  );

  return results;
}

/**
 * Find triggers for CRM field change events
 */
async function findCrmFieldChangeTriggers(
  organizationId: string,
  fieldKey: string,
  value: unknown
): Promise<MatchedTrigger[]> {
  // Get potential triggers for this field
  const potentialTriggers = await db
    .select({
      id: automationTriggers.id,
      journeyId: automationTriggers.journeyId,
      organizationId: automationTriggers.organizationId,
      triggerType: automationTriggers.triggerType,
      expression: automationTriggers.expression,
    })
    .from(automationTriggers)
    .where(
      and(
        eq(automationTriggers.organizationId, organizationId),
        eq(automationTriggers.triggerType, "crm_field_change"),
        eq(automationTriggers.crmFieldKey, fieldKey),
        eq(automationTriggers.isActive, true)
      )
    );

  // Filter by expression evaluation
  const matchingTriggers = potentialTriggers.filter((trigger) =>
    evaluateExpression(trigger.expression, value)
  );

  log.debug(
    {
      organizationId,
      fieldKey,
      value,
      potentialCount: potentialTriggers.length,
      matchCount: matchingTriggers.length,
    },
    "automationMatcher:crmFieldChangeTriggers"
  );

  return matchingTriggers.map(({ expression, ...rest }) => rest);
}

// =============================================================================
// TRIGGER QUERIES (for management)
// =============================================================================

/**
 * Get all triggers for a journey
 */
export async function getTriggersForJourney(journeyId: string): Promise<MatchedTrigger[]> {
  const results = await db
    .select({
      id: automationTriggers.id,
      journeyId: automationTriggers.journeyId,
      organizationId: automationTriggers.organizationId,
      triggerType: automationTriggers.triggerType,
    })
    .from(automationTriggers)
    .where(eq(automationTriggers.journeyId, journeyId));

  return results;
}

/**
 * Get all active triggers for an organization
 */
export async function getActiveTriggersForOrganization(
  organizationId: string
): Promise<MatchedTrigger[]> {
  const results = await db
    .select({
      id: automationTriggers.id,
      journeyId: automationTriggers.journeyId,
      organizationId: automationTriggers.organizationId,
      triggerType: automationTriggers.triggerType,
    })
    .from(automationTriggers)
    .where(
      and(
        eq(automationTriggers.organizationId, organizationId),
        eq(automationTriggers.isActive, true)
      )
    );

  return results;
}

