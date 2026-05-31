import { describe, expect, it } from "vitest";
import { createLogger } from "@journey/logger";
import type { JourneyConfig, NodeMetadata } from "@journey/schemas";
import { NodeVersionRegistry } from "@journey/schemas";

import { MigrationRunner } from "../version/migration-runner";

const createMetadata = (): NodeMetadata => ({
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  version: "1.0.0",
  status: "active",
});

const createJourney = () => ({
  nodes: [
    {
      id: "start",
      type: "custom",
      position: { x: 0, y: 0 },
      data: { type: "start", label: "Start", content: "Hello", schemaVersion: 1 },
      metadata: createMetadata(),
    },
    {
      id: "message",
      type: "custom",
      position: { x: 0, y: 120 },
      data: {
        type: "message",
        label: "Message",
        content: "Hi",
        schemaVersion: 1,
      },
      metadata: createMetadata(),
    },
  ],
  edges: [],
});

describe("MigrationRunner", () => {
  it("migrates nodes to latest schema version", () => {
    const registry = new NodeVersionRegistry();
    registry.registerMigration({
      nodeType: "message",
      fromVersion: 1,
      toVersion: 2,
      migrate: (data: { content: string; schemaVersion: number }) => ({
        ...data,
        content: `${data.content}!`,
        schemaVersion: 2,
      }),
    });

    const runner = new MigrationRunner(registry, createLogger("test:migration"));
    const journey = createJourney() as JourneyConfig; // Legacy v1 payload for migration test.
    const migrated = runner.migrateJourney(journey);

    const migratedMessage = migrated.nodes.find((node) => node.id === "message");
    expect(migratedMessage?.data.type).toBe("message");
    if (migratedMessage?.data.type === "message") {
      expect(migratedMessage.data.schemaVersion).toBe(2);
      expect(migratedMessage.data.content).toBe("Hi!");
    }
  });

  it("returns the original journey when no migrations are needed", () => {
    const registry = new NodeVersionRegistry();
    const runner = new MigrationRunner(registry, createLogger("test:migration"));
    const journey = createJourney() as JourneyConfig; // Legacy v1 payload for migration test.

    const migrated = runner.migrateJourney(journey);

    expect(migrated).toBe(journey);
  });
});
