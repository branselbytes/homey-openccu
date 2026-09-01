export interface CacheEnvelope<T> {
  readonly schemaVersion: number;
  readonly writtenAt: string;
  readonly value: T;
}

export interface CacheStorage {
  read(key: string): Promise<string | undefined>;
  write(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class VersionedCache<T> {
  readonly #storage: CacheStorage;
  readonly #namespace: string;
  readonly #schemaVersion: number;

  constructor(storage: CacheStorage, namespace: string, schemaVersion: number) {
    this.#storage = storage;
    this.#namespace = namespace;
    this.#schemaVersion = schemaVersion;
  }

  async get(key: string): Promise<T | undefined> {
    const raw = await this.#storage.read(this.#key(key));
    if (raw === undefined) return undefined;
    try {
      const envelope = JSON.parse(raw) as Partial<CacheEnvelope<T>>;
      if (envelope.schemaVersion !== this.#schemaVersion || !("value" in envelope)) return undefined;
      return envelope.value;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: T): Promise<void> {
    const envelope: CacheEnvelope<T> = {
      schemaVersion: this.#schemaVersion,
      writtenAt: new Date().toISOString(),
      value,
    };
    await this.#storage.write(this.#key(key), JSON.stringify(envelope));
  }

  delete(key: string): Promise<void> {
    return this.#storage.delete(this.#key(key));
  }

  #key(key: string): string {
    return `${this.#namespace}:${key}`;
  }
}

export function createDescriptionCacheKey(
  centralId: string,
  interfaceId: string,
  channelAddress: string,
  paramsetKey: string,
): string {
  return [centralId, interfaceId, channelAddress, paramsetKey].map(encodeURIComponent).join("/");
}
