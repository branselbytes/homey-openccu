import type { CacheStorage } from "./versioned-cache";

export interface MemoryCacheStorageOptions {
  readonly maxEntries?: number;
  /** UTF-8 key + value bytes; this bounds payload size, not total JS heap. */
  readonly maxBytes?: number;
}

interface MemoryCacheEntry {
  readonly value: string;
  readonly bytes: number;
}

/** Ephemeral LRU storage; never sends metadata through Homey's settings API. */
export class MemoryCacheStorage implements CacheStorage {
  readonly #maxEntries: number;
  readonly #maxBytes: number;
  readonly #entries = new Map<string, MemoryCacheEntry>();
  #bytes = 0;

  constructor(options: MemoryCacheStorageOptions = {}) {
    this.#maxEntries = options.maxEntries ?? 512;
    this.#maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
    if (!Number.isSafeInteger(this.#maxEntries) || this.#maxEntries < 1)
      throw new RangeError("Cache entry limit must be a positive safe integer");
    if (!Number.isSafeInteger(this.#maxBytes) || this.#maxBytes < 1)
      throw new RangeError("Cache byte limit must be a positive safe integer");
  }

  read(key: string): Promise<string | undefined> {
    const entry = this.#entries.get(key);
    if (entry === undefined) return Promise.resolve(undefined);
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return Promise.resolve(entry.value);
  }

  write(key: string, value: string): Promise<void> {
    // Remove a previous value even when the replacement cannot be cached:
    // keeping it would let stale metadata survive a successful fresh read.
    this.#remove(key);
    const bytes =
      Buffer.byteLength(key, "utf8") + Buffer.byteLength(value, "utf8");
    if (bytes > this.#maxBytes) return Promise.resolve();
    while (
      this.#entries.size >= this.#maxEntries ||
      this.#bytes + bytes > this.#maxBytes
    ) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) break;
      this.#remove(oldest);
    }
    this.#entries.set(key, { value, bytes });
    this.#bytes += bytes;
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.#remove(key);
    return Promise.resolve();
  }

  #remove(key: string): void {
    const entry = this.#entries.get(key);
    if (entry === undefined) return;
    this.#entries.delete(key);
    this.#bytes -= entry.bytes;
  }
}
