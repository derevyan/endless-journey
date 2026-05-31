import { describe, expect, it } from "vitest";

import { startNodeDescriptor } from "../nodes/types/journey/start/descriptor";
import { messageNodeDescriptor } from "../nodes/types/journey/message/descriptor";
import { conditionNodeDescriptor } from "../nodes/types/journey/condition/descriptor";
import { waitNodeDescriptor } from "../nodes/types/journey/wait/descriptor";
import { webhookNodeDescriptor } from "../nodes/types/journey/webhook/descriptor";
import { crmNodeDescriptor } from "../nodes/types/journey/crm/descriptor";
import { teleportNodeDescriptor } from "../nodes/types/journey/teleport/descriptor";
import { endNodeDescriptor } from "../nodes/types/journey/end/descriptor";
import { questionnaireNodeDescriptor } from "../nodes/types/journey/questionnaire/descriptor";
import { agentNodeDescriptor } from "../nodes/types/journey/agent/descriptor";

const journeyDescriptors = [
  { name: "start", descriptor: startNodeDescriptor },
  { name: "message", descriptor: messageNodeDescriptor },
  { name: "condition", descriptor: conditionNodeDescriptor },
  { name: "wait", descriptor: waitNodeDescriptor },
  { name: "webhook", descriptor: webhookNodeDescriptor },
  { name: "crm", descriptor: crmNodeDescriptor },
  { name: "teleport", descriptor: teleportNodeDescriptor },
  { name: "end", descriptor: endNodeDescriptor },
  { name: "questionnaire", descriptor: questionnaireNodeDescriptor },
  { name: "agent", descriptor: agentNodeDescriptor },
];

describe("Journey Node Descriptors", () => {
  describe("createDefaultData() validation", () => {
    it.each(journeyDescriptors)(
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
    it.each(journeyDescriptors)(
      "$name: isType() should accept createDefaultData() output",
      ({ descriptor }) => {
        const defaultData = descriptor.createDefaultData();
        expect(descriptor.isType(defaultData)).toBe(true);
      }
    );
  });

  describe("descriptor metadata", () => {
    it.each(journeyDescriptors)(
      "$name: should have required metadata",
      ({ descriptor }) => {
        expect(descriptor.system).toBe("journey");
        expect(descriptor.type).toBeDefined();
        expect(descriptor.version).toBeGreaterThanOrEqual(1);
        expect(descriptor.displayName).toBeDefined();
        expect(descriptor.description).toBeDefined();
        expect(descriptor.category).toBeDefined();
        expect(descriptor.handles).toBeDefined();
        expect(descriptor.handles.inputs).toBeInstanceOf(Array);
        expect(descriptor.handles.outputs).toBeInstanceOf(Array);
      }
    );
  });
});
