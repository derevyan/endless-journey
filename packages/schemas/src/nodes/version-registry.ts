export type NodeMigration<TFrom = unknown, TTo = unknown> = (data: TFrom) => TTo;

export interface MigrationEntry<TFrom = unknown, TTo = unknown> {
  nodeType: string;
  fromVersion: number;
  toVersion: number;
  migrate: NodeMigration<TFrom, TTo>;
}

type AnyMigrationEntry = MigrationEntry<unknown, unknown>;

export class NodeVersionRegistry {
  private migrations = new Map<string, Map<number, AnyMigrationEntry>>();

  registerMigration<TFrom, TTo>(entry: MigrationEntry<TFrom, TTo>): void {
    const nodeMigrations = this.migrations.get(entry.nodeType) ?? new Map<number, AnyMigrationEntry>();
    if (nodeMigrations.has(entry.fromVersion)) {
      throw new Error(
        `Migration already registered for ${entry.nodeType} v${entry.fromVersion}`
      );
    }
    nodeMigrations.set(entry.fromVersion, entry as AnyMigrationEntry);
    this.migrations.set(entry.nodeType, nodeMigrations);
  }

  getMigration(nodeType: string, fromVersion: number): MigrationEntry | undefined {
    return this.migrations.get(nodeType)?.get(fromVersion);
  }

  getLatestVersion(nodeType: string): number {
    const nodeMigrations = this.migrations.get(nodeType);
    if (!nodeMigrations || nodeMigrations.size === 0) {
      return 1;
    }
    let latest = 1;
    for (const entry of nodeMigrations.values()) {
      latest = Math.max(latest, entry.toVersion);
    }
    return latest;
  }

  getMigrationChain(nodeType: string, fromVersion: number): MigrationEntry[] {
    const chain: MigrationEntry[] = [];
    const seen = new Set<number>();
    let currentVersion = fromVersion;

    while (true) {
      if (seen.has(currentVersion)) {
        throw new Error(`Migration loop detected for ${nodeType} at v${currentVersion}`);
      }
      seen.add(currentVersion);

      const entry = this.getMigration(nodeType, currentVersion);
      if (!entry) {
        break;
      }
      chain.push(entry);
      currentVersion = entry.toVersion;
    }

    return chain;
  }

  migrateToLatest<T>(nodeType: string, data: unknown, currentVersion: number): T {
    const latestVersion = this.getLatestVersion(nodeType);
    if (currentVersion >= latestVersion) {
      return data as T;
    }

    const chain = this.getMigrationChain(nodeType, currentVersion);
    const finalVersion = chain.reduce((version, entry) => entry.toVersion, currentVersion);

    if (chain.length === 0 || finalVersion !== latestVersion) {
      throw new Error(
        `No migration chain for ${nodeType} from v${currentVersion} to v${latestVersion}`
      );
    }

    return chain.reduce((value, entry) => entry.migrate(value), data) as T;
  }
}

export const nodeVersionRegistry = new NodeVersionRegistry();
