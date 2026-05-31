/**
 * Workflow Form Registry
 *
 * Form handlers are auto-registered when nodes register with workflowNodeRegistry.
 */

import type { WorkflowNodeType } from "@journey/schemas";

import { FormRegistry } from "@/features/nodes/shared/form-registry";

export const workflowFormRegistry = new FormRegistry<WorkflowNodeType, unknown, unknown, unknown>();
