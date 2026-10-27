import { emptySnapshot, SCHEMA_VERSION, type FinanceSnapshot } from '../schema/snapshot';
import { migrateWealthSnapshot } from '../../features/wealth/migration/migrateAccounts';
import { withSettingsDefaults } from '../../features/settings/lib/settingsDefaults';

export interface StorageDriver {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

const KEY = 'mali.finance.v1';

export class LocalFinanceDb {
  constructor(private readonly driver: StorageDriver) {}

  load(): FinanceSnapshot {
    const raw = this.driver.get(KEY);
    if (!raw) {
      return emptySnapshot();
    }
    try {
      const parsed = JSON.parse(raw) as FinanceSnapshot;
      const merged: FinanceSnapshot = {
        ...emptySnapshot(),
        ...parsed,
        version: SCHEMA_VERSION,
        goals: parsed.goals ?? [],
        recurring: parsed.recurring ?? [],
        netWorthHistory: parsed.netWorthHistory ?? [],
        settings: withSettingsDefaults({
          ...emptySnapshot().settings,
          ...parsed.settings,
        }),
      };
      return migrateWealthSnapshot(merged);
    } catch {
      // Keep the unreadable bytes: the next save() replaces KEY with an empty snapshot.
      this.driver.set(`${KEY}.corrupt.${Date.now()}`, raw);
      return emptySnapshot();
    }
  }

  hasSnapshot(): boolean {
    return Boolean(this.driver.get(KEY));
  }

  /**
   * Same bytes as JSON.stringify(snapshot), still one atomic write, but each top-level
   * section is re-serialized only when its reference changed. Store updates are
   * immutable, so a settings toggle or sync-queue write no longer re-stringifies
   * tens of thousands of transactions.
   */
  save(snapshot: FinanceSnapshot): void {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        continue;
      }
      let hit = this.sectionCache.get(key);
      if (!hit || hit.ref !== value) {
        hit = { ref: value, json: JSON.stringify(value) };
        this.sectionCache.set(key, hit);
      }
      parts.push(`${JSON.stringify(key)}:${hit.json}`);
    }
    this.driver.set(KEY, `{${parts.join(',')}}`);
  }

  private readonly sectionCache = new Map<string, { ref: unknown; json: string }>();
}
