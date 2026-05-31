import { describe, expect, it } from "vitest";

import { NodeVersionRegistry } from "../nodes/version";

describe("NodeVersionRegistry", () => {
  it("migrates data through a chained migration path", () => {
    const registry = new NodeVersionRegistry();

    registry.registerMigration({
      nodeType: "message",
      fromVersion: 1,
      toVersion: 2,
      migrate: (data: { value: number; schemaVersion: number }) => ({
        ...data,
        value: data.value + 1,
        schemaVersion: 2,
      }),
    });

    registry.registerMigration({
      nodeType: "message",
      fromVersion: 2,
      toVersion: 3,
      migrate: (data: { value: number; schemaVersion: number }) => ({
        ...data,
        value: data.value + 1,
        schemaVersion: 3,
      }),
    });

    const migrated = registry.migrateToLatest<{ value: number; schemaVersion: number }>(
      "message",
      { value: 1, schemaVersion: 1 },
      1
    );

    expect(migrated).toEqual({ value: 3, schemaVersion: 3 });
  });

  it("returns latest version as 1 when no migrations are registered", () => {
    const registry = new NodeVersionRegistry();

    expect(registry.getLatestVersion("message")).toBe(1);
  });

  it("returns original data when already at latest version", () => {
    const registry = new NodeVersionRegistry();

    const data = { value: 5, schemaVersion: 1 };
    const migrated = registry.migrateToLatest<typeof data>("message", data, 1);

    expect(migrated).toBe(data);
  });
});
