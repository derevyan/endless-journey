/**
 * Field Definitions
 *
 * Concrete field definitions for the field registry.
 * Each field wires up extractors and builders from node-form-extractors and node-form-builders.
 *
 * @module nodes/forms/field-definitions
 */

import type { ButtonConfig } from "@journey/schemas";

import { dhmsToSeconds } from "@/shared/lib/utils/duration-utils";
import type { JourneyNode } from "@/features/nodes/journey/react-flow-types";

import { defineField, registerFields, type FieldDefinition, type FormState, type NodeData } from "./field-registry";
import {
  extractTimerFields,
  extractMediaField,
  extractDurationFields,
  extractTagAction,
  extractVariableAction,
  extractCrmAction,
  extractTimeoutFields,
  hasTimerSet,
  hasMediaSet,
} from "./node-form-extractors";
import type {
  MediaFormValue,
  TagActionFormValue,
  VariableActionFormValue,
  VariableOperationFormValue,
} from "./node-form-builders";

// =============================================================================
// TIMER FIELD
// =============================================================================

/**
 * Timer field definition.
 * Handles timer DHMS fields for message nodes.
 */
export const timerField: FieldDefinition = defineField({
  id: "timer",
  capability: "hasTimer",

  extract: (node: JourneyNode) => ({ ...extractTimerFields(node) }),

  build: (form: FormState): Partial<NodeData> => {
    const timerDays = (form.timerDays as number) ?? 0;
    const timerHours = (form.timerHours as number) ?? 0;
    const timerMinutes = (form.timerMinutes as number) ?? 0;
    const timerSeconds = (form.timerSeconds as number) ?? 0;

    const totalSeconds = dhmsToSeconds(timerDays, timerHours, timerMinutes, timerSeconds);

    if (totalSeconds > 0) {
      return { timer: { seconds: totalSeconds } };
    }
    return { timer: undefined };
  },

  hasValue: (node: JourneyNode) => hasTimerSet(node),
});

// =============================================================================
// MEDIA FIELD
// =============================================================================

/**
 * Media field definition.
 * Handles media (image/video) attachment for nodes.
 */
export const mediaField: FieldDefinition = defineField({
  id: "media",
  capability: "hasMedia",

  extract: (node: JourneyNode) => ({
    media: extractMediaField(node),
  }),

  build: (form: FormState): Partial<NodeData> => {
    const media = form.media as MediaFormValue | null | undefined;

    if (media && media.url) {
      return {
        media: {
          type: media.type,
          url: media.url,
          ...(media.filename && { filename: media.filename }),
          ...(media.mediaId && { mediaId: media.mediaId }),
        },
      };
    }
    return { media: undefined };
  },

  hasValue: (node: JourneyNode) => hasMediaSet(node),
});

// =============================================================================
// DURATION FIELD
// =============================================================================

/**
 * Duration field definition.
 * Handles wait duration for wait nodes.
 */
export const durationField: FieldDefinition = defineField({
  id: "duration",
  capability: "hasDuration",

  extract: (node: JourneyNode) => ({ ...extractDurationFields(node) }),

  build: (form: FormState): Partial<NodeData> => {
    const days = (form.durationDays as number) ?? 0;
    const hours = (form.durationHours as number) ?? 0;
    const minutes = (form.durationMinutes as number) ?? 0;
    const seconds = (form.durationSeconds as number) ?? 0;

    const totalSeconds = dhmsToSeconds(days, hours, minutes, seconds);

    // Don't enforce minimum here - let schema validation handle it if needed
    // This ensures extract(build(x)) === x for round-trip consistency
    return {
      duration: { seconds: totalSeconds },
    };
  },

  hasValue: (node: JourneyNode) => {
    if (!("duration" in node.data) || !node.data.duration) return false;
    const duration = node.data.duration;
    if (typeof duration !== "object") return false;
    return "seconds" in duration && typeof duration.seconds === "number" && duration.seconds > 0;
  },
});

// =============================================================================
// TAG ACTION FIELD
// =============================================================================

/**
 * Tag action field definition.
 * Handles tag add/remove operations.
 */
export const tagActionField: FieldDefinition = defineField({
  id: "tagAction",
  capability: "hasTagAction",

  extract: (node: JourneyNode) => ({
    tagAction: extractTagAction(node),
  }),

  build: (form: FormState): Partial<NodeData> => {
    const tagAction = form.tagAction as TagActionFormValue | undefined;

    if (!tagAction) return {};

    const tagsAdd = (tagAction.tags?.add || []).filter((t) => t.trim() !== "");
    const tagsRemove = (tagAction.tags?.remove || []).filter((t) => t.trim() !== "");

    if (tagsAdd.length === 0 && tagsRemove.length === 0) {
      return { tagAction: undefined };
    }

    return {
      tagAction: {
        tags: {
          ...(tagsAdd.length > 0 && { add: tagsAdd }),
          ...(tagsRemove.length > 0 && { remove: tagsRemove }),
        },
      },
    };
  },

  hasValue: (node: JourneyNode) => {
    if (!("tagAction" in node.data) || !node.data.tagAction) return false;
    const tagAction = node.data.tagAction as TagActionFormValue;
    const hasAdd = (tagAction.tags?.add || []).length > 0;
    const hasRemove = (tagAction.tags?.remove || []).length > 0;
    return hasAdd || hasRemove;
  },
});

// =============================================================================
// VARIABLE ACTION FIELD
// =============================================================================

/**
 * Variable action field definition.
 * Handles variable operations (set, delete, increment, etc.).
 */
export const variableActionField: FieldDefinition = defineField({
  id: "variableAction",
  capability: "hasVariableAssignment",

  extract: (node: JourneyNode) => ({
    variableAction: extractVariableAction(node),
  }),

  build: (form: FormState): Partial<NodeData> => {
    const variableAction = form.variableAction as VariableActionFormValue | undefined;

    if (!variableAction) return {};

    const filterValid = (ops: VariableOperationFormValue[] | undefined) =>
      (ops ?? []).filter((op) => op.key && op.key.trim() !== "");

    const userOps = filterValid(variableAction.userOperations);
    const journeyOps = filterValid(variableAction.journeyOperations);
    const globalOps = filterValid(variableAction.globalOperations);

    if (userOps.length === 0 && journeyOps.length === 0 && globalOps.length === 0) {
      return { variableAction: undefined };
    }

    return {
      variableAction: {
        ...(userOps.length > 0 && { userOperations: userOps }),
        ...(journeyOps.length > 0 && { journeyOperations: journeyOps }),
        ...(globalOps.length > 0 && { globalOperations: globalOps }),
      },
    };
  },

  hasValue: (node: JourneyNode) => {
    if (!("variableAction" in node.data) || !node.data.variableAction) return false;
    const va = node.data.variableAction as VariableActionFormValue;
    const hasUser = (va.userOperations || []).length > 0;
    const hasJourney = (va.journeyOperations || []).length > 0;
    const hasGlobal = (va.globalOperations || []).length > 0;
    return hasUser || hasJourney || hasGlobal;
  },
});

// =============================================================================
// CRM ACTION FIELD
// =============================================================================

/**
 * CRM action field definition.
 * Handles CRM pipeline/stage updates.
 */
export const crmActionField: FieldDefinition = defineField({
  id: "crmAction",
  capability: "hasCrmAction",

  extract: (node: JourneyNode) => ({
    crmAction: extractCrmAction(node),
  }),

  build: (form: FormState): Partial<NodeData> => {
    const crmAction = form.crmAction as { pipelineId?: string; stageId?: string; notes?: string } | undefined;

    if (!crmAction) return {};

    const hasPipeline = crmAction.pipelineId && crmAction.pipelineId.trim() !== "";
    const hasStage = crmAction.stageId && crmAction.stageId.trim() !== "";
    const hasNotes = crmAction.notes && crmAction.notes.trim() !== "";

    if (!hasPipeline && !hasStage && !hasNotes) {
      return { crmAction: undefined };
    }

    const result: Record<string, unknown> = {};
    if (hasPipeline) result.pipelineId = crmAction.pipelineId;
    if (hasStage) result.stageId = crmAction.stageId;
    // Don't trim - preserve user's whitespace for round-trip consistency
    if (hasNotes) result.notes = crmAction.notes;

    return { crmAction: result };
  },

  hasValue: (node: JourneyNode) => {
    if (!("crmAction" in node.data) || !node.data.crmAction) return false;
    const ca = node.data.crmAction as { pipelineId?: string; stageId?: string; notes?: string };
    return !!(ca.pipelineId || ca.stageId || ca.notes);
  },
});

// =============================================================================
// BUTTONS FIELD
// =============================================================================

/**
 * Buttons field definition.
 * Handles interactive button arrays for message nodes.
 */
export const buttonsField: FieldDefinition = defineField({
  id: "buttons",
  capability: "hasButtons",

  extract: (node: JourneyNode) => {
    if (!("buttons" in node.data) || !Array.isArray(node.data.buttons)) {
      return { buttons: [] };
    }
    return {
      // Filter out buttons with empty text (matches builder behavior for round-trip consistency)
      buttons: node.data.buttons
        .filter((btn: ButtonConfig) => btn.text && btn.text.trim() !== "")
        .map((btn: ButtonConfig) => ({
          id: btn.id,
          text: btn.text,
          targetNodeId: btn.targetNodeId,
        })),
    };
  },

  build: (form: FormState): Partial<NodeData> => {
    const buttons = form.buttons as ButtonConfig[] | undefined;

    if (!buttons || buttons.length === 0) {
      return { buttons: undefined };
    }

    // Filter out buttons with empty text
    const validButtons = buttons.filter((btn) => btn.text && btn.text.trim() !== "");
    if (validButtons.length === 0) {
      return { buttons: undefined };
    }

    return { buttons: validButtons };
  },

  hasValue: (node: JourneyNode) => {
    if (!("buttons" in node.data) || !Array.isArray(node.data.buttons)) {
      return false;
    }
    return node.data.buttons.length > 0;
  },
});

// =============================================================================
// TIMEOUT FIELD
// =============================================================================

/**
 * Timeout field definition.
 * Handles timeout duration with optional fields:
 * - targetNodeId: direct timeout routing for questionnaire/teleport nodes
 * - timeoutMessage: for agent nodes (message to send on timeout)
 */
export const timeoutField: FieldDefinition = defineField({
  id: "timeout",
  capability: "hasTimeout",

  extract: (node: JourneyNode) => extractTimeoutFields(node),

  build: (form: FormState): Partial<NodeData> => {
    const timeoutDays = (form.timeoutDays as number) ?? 0;
    const timeoutHours = (form.timeoutHours as number) ?? 0;
    const timeoutMinutes = (form.timeoutMinutes as number) ?? 0;
    const timeoutSeconds = (form.timeoutSeconds as number) ?? 0;
    const targetNodeId = form.timeoutTargetNodeId as string | undefined;
    const timeoutMessage = form.timeoutMessage as string | undefined;

    const totalSeconds = dhmsToSeconds(timeoutDays, timeoutHours, timeoutMinutes, timeoutSeconds);

    if (totalSeconds <= 0) {
      return { timeout: undefined };
    }

    return {
      timeout: {
        seconds: totalSeconds,
        // Use != null to allow empty string "" (which is falsy but valid)
        ...(targetNodeId != null && { targetNodeId }),
        ...(timeoutMessage && { timeoutMessage }),
      },
    };
  },

  hasValue: (node: JourneyNode) => {
    if (!("timeout" in node.data) || !node.data.timeout) return false;
    const timeout = node.data.timeout;
    if (typeof timeout !== "object") return false;
    return "seconds" in timeout && typeof timeout.seconds === "number" && timeout.seconds > 0;
  },
});

// =============================================================================
// QUESTIONS FIELD
// =============================================================================

/**
 * Questions field definition.
 * Handles multi-question sequences for questionnaire nodes.
 */
export const questionsField: FieldDefinition = defineField({
  id: "questions",
  capability: "hasQuestions",

  extract: (node: JourneyNode) => {
    if (!("questions" in node.data) || !Array.isArray(node.data.questions)) {
      return { questions: [] };
    }

    // Map questions with proper defaults for form state
    interface QuestionData {
      id: string;
      content: string;
      responseType?: "buttons" | "text" | "any";
      buttons?: Array<{ id: string; text: string; targetNodeId?: string }>;
      validation?: {
        pattern?: string;
        minLength?: number;
        maxLength?: number;
        errorMessage?: string;
      };
      storeResponseAs?: string;
      hint?: string;
      skipIf?: string;
      required?: boolean;
    }

    return {
      // Don't inject defaults - preserve original values for round-trip consistency
      // Schema defaults should be used at form initialization, not extraction
      questions: (node.data.questions as QuestionData[]).map((q) => ({
        id: q.id,
        content: q.content,
        responseType: q.responseType,
        buttons: q.buttons?.map((b) => ({
          id: b.id,
          text: b.text,
          targetNodeId: b.targetNodeId,
        })),
        validation: q.validation,
        storeResponseAs: q.storeResponseAs,
        hint: q.hint,
        skipIf: q.skipIf,
        required: q.required,
      })),
    };
  },

  build: (form: FormState): Partial<NodeData> => {
    const questions = form.questions as unknown[] | undefined;

    if (!questions || questions.length === 0) {
      return { questions: [] };
    }

    return { questions };
  },

  hasValue: (node: JourneyNode) => {
    if (!("questions" in node.data) || !Array.isArray(node.data.questions)) {
      return false;
    }
    return node.data.questions.length > 0;
  },
});

// =============================================================================
// ALL FIELDS
// =============================================================================

/**
 * All built-in field definitions.
 * Register these with the field registry during app initialization.
 */
export const builtinFields: FieldDefinition[] = [
  timerField,
  mediaField,
  durationField,
  tagActionField,
  variableActionField,
  crmActionField,
  buttonsField,
  timeoutField,
  questionsField,
];

// Register all built-in fields on module load
registerFields(builtinFields);
