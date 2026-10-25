import type { MMKV } from 'react-native-mmkv';
import type { StorageDriver } from './localDb';

export class MmkvStorage implements StorageDriver {
  constructor(private readonly kv: MMKV) {}

  get(key: string) {
    return this.kv.getString(key);
  }

  set(key: string, value: string) {
    this.kv.set(key, value);
  }

  delete(key: string) {
    this.kv.delete(key);
  }

  clearAll() {
    this.kv.clearAll();
  }
}
