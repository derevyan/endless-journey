import { describe, expect, it } from "vitest";

import { workflowStartNodeDescriptor } from "../nodes/types/workflow/start/descriptor";
import { workflowAgentNodeDescriptor } from "../nodes/types/workflow/agent/descriptor";
import { workflowEndNodeDescriptor } from "../nodes/types/workflow/end/descriptor";
import { workflowGuardNodeDescriptor } from "../nodes/types/workflow/guard/descriptor";
import { workflowContextNodeDescriptor } from "../nodes/types/workflow/context/descriptor";
import { workflowMcpNodeDescriptor } from "../nodes/types/workflow/mcp/descriptor";
import { workflowQuestionUnderstandingNodeDescriptor } from "../nodes/types/workflow/question-understanding/descriptor";
import { workflowIfElseNodeDescriptor } from "../nodes/types/workflow/if-else/descriptor";
import { workflowUserApprovalNodeDescriptor } from "../nodes/types/workflow/user-approval/descriptor";
import { workflowTransformNodeDescriptor } from "../nodes/types/workflow/transform/descriptor";
import { workflowSetStateNodeDescriptor } from "../nodes/types/workflow/set-state/descriptor";

const workflowDescriptors = [
  { name: "start", descriptor: workflowStartNodeDescriptor },
  { name: "agent", descriptor: workflowAgentNodeDescriptor },
  { name: "end", descriptor: workflowEndNodeDescriptor },
  { name: "guard", descriptor: workflowGuardNodeDescriptor },
  { name: "context", descriptor: workflowContextNodeDescriptor },
  { name: "mcp", descriptor: workflowMcpNodeDescriptor },
  { name: "question_understanding", descriptor: workflowQuestionUnderstandingNodeDescriptor },
  { name: "if_else", descriptor: workflowIfElseNodeDescriptor },
  { name: "user_approval", descriptor: workflowUserApprovalNodeDescriptor },
  { name: "transform", descriptor: workflowTransformNodeDescriptor },
  { name: "set_state", descriptor: workflowSetStateNodeDescriptor },
];

describe("Workflow Node Descriptors", () => {
  describe("createDefaultData() validation", () => {
    it.each(workflowDescriptors)(
      "$name: createDefaultData() should match schema",
      ({ name, descriptor }) => {
        const defaultData = descriptor.createDefaultData();
        const result = descriptor.schema.safeParse(defaultData);

        if (!result.success) {
          const errors = result.error.issues
            .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
            .join("\n");
          throw new Error(
            `${name} descriptor createDefaultData() doesn't match schema:\n${errors}\n\nDefault data: ${JSON.stringify(defaultData, null, 2)}`
          );
        }

        expect(result.success).toBe(true);
      }
    );
  });

  describe("isType() validation", () => {
    it.each(workflowDescriptors)(
      "$name: isType() should accept createDefaultData() output",
      ({ descriptor }) => {
        const defaultData = descriptor.createDefaultData();
        expect(descriptor.isType(defaultData)).toBe(true);
      }
    );

    it.each(workflowDescriptors)(
      "$name: isType() should reject invalid data",
      ({ descriptor }) => {
        expect(descriptor.isType(null)).toBe(false);
        expect(descriptor.isType("invalid")).toBe(false);
        expect(descriptor.isType(123)).toBe(false);
      }
    );
  });

  describe("descriptor metadata", () => {
    it.each(workflowDescriptors)(
      "$name: should have required metadata",
      ({ descriptor }) => {
        expect(descriptor.system).toBe("workflow");
        expect(descriptor.type).toBeDefined();
        expect(descriptor.version).toBeGreaterThanOrEqual(1);
        expect(descriptor.displayName).toBeDefined();
        expect(descriptor.description).toBeDefined();
        expect(descriptor.category).toBeDefined();
        expect(descriptor.size).toMatch(/^(compact|standard)$/);
        expect(descriptor.handles).toBeDefined();
        expect(descriptor.handles.inputs).toBeInstanceOf(Array);
        expect(descriptor.handles.outputs).toBeInstanceOf(Array);
      }
    );
  });
});
