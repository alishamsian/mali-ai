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

  save(snapshot: FinanceSnapshot): void {
    this.driver.set(KEY, JSON.stringify(snapshot));
  }
}
