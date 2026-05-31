import { describe, expect, it } from "vitest";

import type { MessageNodeData } from "../nodes/types/journey/message/schema";
import { nodeVersionRegistry } from "../nodes/version";

import "../nodes/migrations";

describe("Node Migrations", () => {
  describe("Message v1 -> v2", () => {
    it("should add contentFormat field", () => {
      const v1Data = {
        type: "message" as const,
        schemaVersion: 1,
        label: "Test",
        content: "Hello world",
      };

      const migrated = nodeVersionRegistry.migrateToLatest<MessageNodeData>(
        "message",
        v1Data,
        1
      );

      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.contentFormat).toBe("text");
    });

    it("should preserve existing fields", () => {
      const v1Data = {
        type: "message" as const,
        schemaVersion: 1,
        label: "Custom Label",
        content: "Rich content",
        buttons: [{ id: "btn1", text: "Click me" }],
      };

      const migrated = nodeVersionRegistry.migrateToLatest<MessageNodeData>("message", v1Data, 1);

      expect(migrated.label).toBe("Custom Label");
      expect(migrated.content).toBe("Rich content");
      expect(migrated.buttons).toHaveLength(1);
    });
  });
});
