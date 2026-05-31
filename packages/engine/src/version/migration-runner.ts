/**
 * Migration Runner
 *
 * Applies node data migrations to bring journeys to latest schema versions.
 */

import type { createLogger } from "@journey/logger";
import type { JourneyConfig, JourneyNodeData, NodeVersionRegistry } from "@journey/schemas";

export class MigrationRunner {
  constructor(
    private versionRegistry: NodeVersionRegistry,
    private log: ReturnType<typeof createLogger>
  ) {}

  /**
   * Migrate a single node to latest version if needed.
   */
  migrateNode(node: JourneyNodeData): JourneyNodeData {
    const currentVersion = node.data.schemaVersion ?? 1;
    const latestVersion = this.versionRegistry.getLatestVersion(node.data.type);

    if (currentVersion >= latestVersion) {
      return node;
    }

    this.log.info(
      {
        nodeId: node.id,
        nodeType: node.data.type,
        fromVersion: currentVersion,
        toVersion: latestVersion,
      },
      "migrationRunner:migratingNode"
    );

    const migratedData = this.versionRegistry.migrateToLatest(
      node.data.type,
      node.data,
      currentVersion
    ) as JourneyNodeData["data"];

    return {
      ...node,
      data: {
        ...migratedData,
        schemaVersion: latestVersion,
      } as JourneyNodeData["data"],
    };
  }

  /**
   * Migrate all nodes in a journey.
   */
  migrateJourney(journey: JourneyConfig): JourneyConfig {
    let changed = false;

    const migratedNodes = journey.nodes.map((node) => {
      const migrated = this.migrateNode(node);
      if (migrated !== node) {
        changed = true;
      }
      return migrated;
    });

    if (!changed) {
      return journey;
    }

    return { ...journey, nodes: migratedNodes };
  }
}

export function createMigrationRunner(
  versionRegistry: NodeVersionRegistry,
  log: ReturnType<typeof createLogger>
): MigrationRunner {
  return new MigrationRunner(versionRegistry, log);
}
