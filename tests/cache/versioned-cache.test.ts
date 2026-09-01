import { describe, expect, it } from "vitest";

import {
  VersionedCache,
  createDescriptionCacheKey,
  type CacheStorage,
} from "../../src/cache/versioned-cache";

class MemoryStorage implements CacheStorage {
  readonly values = new Map<string, string>();
  read(key: string): Promise<string | undefined> {
    return Promise.resolve(this.values.get(key));
  }
  write(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
  delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }
}

describe("VersionedCache", () => {
  it("reads matching schemas and ignores stale schemas", async () => {
    const storage = new MemoryStorage();
    const current = new VersionedCache(storage, "descriptions", 2);
    await current.set("key", { type: "BOOL" });
    await expect(current.get("key")).resolves.toEqual({ type: "BOOL" });
    await expect(
      new VersionedCache(storage, "descriptions", 3).get("key"),
    ).resolves.toBeUndefined();
  });

  it("builds collision-safe description keys", () => {
    expect(
      createDescriptionCacheKey("ccu/1", "HmIP-RF", "001:1", "VALUES"),
    ).toBe("ccu%2F1/HmIP-RF/001%3A1/VALUES");
  });
});
