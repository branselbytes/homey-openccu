import type { CacheStorage } from "../cache/versioned-cache";

export interface CacheSettings {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  unset(key: string): void;
}

export class HomeySettingsCacheStorage implements CacheStorage {
  readonly #settings: CacheSettings;

  constructor(settings: CacheSettings) {
    this.#settings = settings;
  }

  read(key: string): Promise<string | undefined> {
    const value = this.#settings.get(key);
    return Promise.resolve(typeof value === "string" ? value : undefined);
  }

  write(key: string, value: string): Promise<void> {
    this.#settings.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.#settings.unset(key);
    return Promise.resolve();
  }
}
