/**
 * Base Registry
 *
 * Shared registry implementation for keyed lookups across packages.
 */

export type RegistryDuplicateHandler<K> = (key: K) => void;

export interface BaseRegistryOptions<K> {
  /**
   * Custom handler for duplicate registration attempts.
   * If provided, this is called instead of throwing an error.
   */
  onDuplicate?: RegistryDuplicateHandler<K>;
  /**
   * Allow duplicate registrations to overwrite existing entries.
   * Default: false (throws on duplicate).
   */
  allowOverwrite?: boolean;
}

export class BaseRegistry<K extends string, V> {
  protected items = new Map<K, V>();
  private onDuplicate?: RegistryDuplicateHandler<K>;
  private allowOverwrite: boolean;

  constructor(options: BaseRegistryOptions<K> | RegistryDuplicateHandler<K> = {}) {
    if (typeof options === "function") {
      this.onDuplicate = options;
      this.allowOverwrite = true;
    } else {
      this.onDuplicate = options.onDuplicate;
      this.allowOverwrite = options.allowOverwrite ?? false;
    }
  }

  register(key: K, item: V): void {
    if (this.items.has(key)) {
      if (this.onDuplicate) {
        this.onDuplicate(key);
      }
      if (!this.allowOverwrite) {
        throw new Error(
          `Registry: Duplicate registration for "${key}". ` +
            `Use override() for intentional replacement.`
        );
      }
    }
    this.items.set(key, item);
  }

  override(key: K, item: V): void {
    if (!this.items.has(key)) {
      throw new Error(`Cannot override: "${key}" not registered`);
    }
    this.items.set(key, item);
  }

  set(key: K, item: V): void {
    this.items.set(key, item);
  }

  get(key: K): V | undefined {
    return this.items.get(key);
  }

  getRequired(key: K): V {
    const item = this.items.get(key);
    if (!item) {
      throw new Error(`Required item not found: "${key}"`);
    }
    return item;
  }

  has(key: K): boolean {
    return this.items.has(key);
  }

  getAll(): V[] {
    return Array.from(this.items.values());
  }

  getKeys(): K[] {
    return Array.from(this.items.keys());
  }
}
