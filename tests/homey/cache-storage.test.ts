import { describe, expect, it, vi } from "vitest";

import { HomeySettingsCacheStorage } from "../../src/homey/cache-storage";

describe("HomeySettingsCacheStorage", () => {
  it("stores only string cache entries in Homey settings", async () => {
    const values = new Map<string, unknown>();
    const settings = {
      get: vi.fn((key: string) => values.get(key)),
      set: vi.fn((key: string, value: unknown) => values.set(key, value)),
      unset: vi.fn((key: string) => values.delete(key)),
    };
    const storage = new HomeySettingsCacheStorage(settings);

    await storage.write("cache:key", "payload");
    await expect(storage.read("cache:key")).resolves.toBe("payload");
    await storage.delete("cache:key");
    await expect(storage.read("cache:key")).resolves.toBeUndefined();
  });
});
