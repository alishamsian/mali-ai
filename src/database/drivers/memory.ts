import type { StorageDriver } from '../drivers/localDb';

export class MemoryStorage implements StorageDriver {
  private readonly mem = new Map<string, string>();

  get(key: string) {
    return this.mem.get(key);
  }

  set(key: string, value: string) {
    this.mem.set(key, value);
  }

  clear() {
    this.mem.clear();
  }
}
