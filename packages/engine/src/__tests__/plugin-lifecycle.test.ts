import { describe, expect, it } from "vitest";

import { followUpPluginDescriptor, type FollowUpPluginData, type JourneyConfig, type NodeMetadata } from "@journey/schemas";

import type { NodeHandler } from "../types";
import { createHandlerRegistryWithOverrides } from "../handlers";
import { createLifecycleManager } from "../lifecycle/lifecycle-manager";
import {
  BackendPluginRegistry,
  type BackendPluginDescriptor,
} from "../plugins/backend-plugin-descriptor";
import { createMockLogger, createMockServices } from "./helpers";

const createMetadata = (): NodeMetadata => ({
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  version: "1.0.0",
  status: "active",
});

describe("NodeLifecycleManager plugin hooks", () => {
  it("invokes node hooks before plugin hooks on activate and after on deactivate", async () => {
    const calls: string[] = [];

    const handler: NodeHandler = {
      nodeType: "message",
      async execute() {
        return { action: "complete" };
      },
      async onActivate() {
        calls.push("node:activate");
      },
      async onDeactivate() {
        calls.push("node:deactivate");
      },
    };

    const handlerRegistry = createHandlerRegistryWithOverrides({
      handlerOverrides: [handler],
    });

    const pluginRegistry = new BackendPluginRegistry();
    const pluginDescriptor = {
      ...followUpPluginDescriptor,
      lifecycle: {
        onActivate: async () => {
          calls.push("plugin:activate");
        },
        onDeactivate: async () => {
          calls.push("plugin:deactivate");
        },
      },
    } satisfies BackendPluginDescriptor<FollowUpPluginData>;

    pluginRegistry.register(pluginDescriptor);

    const journey: JourneyConfig = {
      nodes: [
        {
          id: "node-1",
          type: "custom",
          position: { x: 0, y: 0 },
          data: {
            type: "message",
            schemaVersion: 2,
            contentFormat: "text",
            label: "Message",
            content: "Hello",
            plugins: [followUpPluginDescriptor.createDefaultData()],
          },
          metadata: createMetadata(),
        },
      ],
      edges: [],
    };

    const lifecycleManager = createLifecycleManager(handlerRegistry, createMockLogger(), pluginRegistry);

    await lifecycleManager.activateJourney(journey, createMockServices(), "journey-1");
    expect(calls).toEqual(["node:activate", "plugin:activate"]);

    calls.length = 0;

    await lifecycleManager.deactivateJourney(journey, createMockServices(), "journey-1");
    expect(calls).toEqual(["plugin:deactivate", "node:deactivate"]);
  });
});
