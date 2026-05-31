import { describe, expect, it } from "vitest";
import { createLogger } from "@journey/logger";
import type { JourneyConfig, NodeMetadata, NodeType } from "@journey/schemas";

import { HandlerRegistry } from "../handlers";
import { NodeLifecycleManager } from "../lifecycle/lifecycle-manager";
import type { EngineServices, NodeHandler } from "../types";

const createMetadata = (): NodeMetadata => ({
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  version: "1.0.0",
  status: "active",
});

const createJourney = (): JourneyConfig => ({
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: { type: "start", schemaVersion: 1, label: "Start", content: "Hello" },
      metadata: createMetadata(),
    },
    {
      id: "message",
      type: "custom",
      position: { x: 0, y: 120 },
      data: { type: "message", schemaVersion: 2, contentFormat: "text", label: "Message", content: "Hi" },
      metadata: createMetadata(),
    },
    {
      id: "end",
      type: "custom",
      position: { x: 0, y: 240 },
      data: { type: "end", schemaVersion: 1, label: "End", content: "Bye" },
      metadata: createMetadata(),
    },
  ],
  edges: [],
});

const createHandler = (nodeType: NodeType, hooks: Partial<NodeHandler> = {}): NodeHandler => ({
  nodeType,
  execute: async () => ({ action: "wait" }),
  ...hooks,
});

describe("NodeLifecycleManager", () => {
  it("activates nodes in journey order and skips nodes without hooks", async () => {
    const activationOrder: string[] = [];
    const registry = new HandlerRegistry([]);
    registry.register(
      createHandler("start", {
        onActivate: async () => {
          activationOrder.push("start");
        },
      })
    );
    registry.register(
      createHandler("message", {
        onActivate: async () => {
          activationOrder.push("message");
        },
      })
    );

    const manager = new NodeLifecycleManager(registry, null, createLogger("test:lifecycle"));
    const results = await manager.activateJourney(
      createJourney(),
      {} as EngineServices,
      "journey-1"
    );

    expect(activationOrder).toEqual(["start", "message"]);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.success)).toBe(true);
  });

  it("deactivates nodes in reverse order", async () => {
    const deactivationOrder: string[] = [];
    const registry = new HandlerRegistry([]);
    registry.register(
      createHandler("start", {
        onDeactivate: async () => {
          deactivationOrder.push("start");
        },
      })
    );
    registry.register(
      createHandler("message", {
        onDeactivate: async () => {
          deactivationOrder.push("message");
        },
      })
    );

    const manager = new NodeLifecycleManager(registry, null, createLogger("test:lifecycle"));
    const results = await manager.deactivateJourney(
      createJourney(),
      {} as EngineServices,
      "journey-1"
    );

    expect(deactivationOrder).toEqual(["message", "start"]);
    expect(results).toHaveLength(2);
  });

  it("continues activation after hook failure", async () => {
    const activationOrder: string[] = [];
    const registry = new HandlerRegistry([]);
    registry.register(
      createHandler("start", {
        onActivate: async () => {
          activationOrder.push("start");
        },
      })
    );
    registry.register(
      createHandler("message", {
        onActivate: async () => {
          activationOrder.push("message");
          throw new Error("boom");
        },
      })
    );
    registry.register(
      createHandler("end", {
        onActivate: async () => {
          activationOrder.push("end");
        },
      })
    );

    const manager = new NodeLifecycleManager(registry, null, createLogger("test:lifecycle"));
    const results = await manager.activateJourney(
      createJourney(),
      {} as EngineServices,
      "journey-1"
    );

    expect(activationOrder).toEqual(["start", "message", "end"]);
    const failed = results.find((result) => result.nodeType === "message");
    expect(failed?.success).toBe(false);
    expect(results).toHaveLength(3);
  });
});
