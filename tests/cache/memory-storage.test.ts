import { describe, expect, it } from "vitest";
import { MemoryCacheStorage } from "../../src/cache/memory-storage";
import { VersionedCache } from "../../src/cache/versioned-cache";

describe("ephemeral memory cache storage", () => {
  it("reads, replaces and invalidates entries through the existing cache contract", async () => {
    const storage = new MemoryCacheStorage();
    const cache = new VersionedCache<{ value: number }>(storage, "fixture", 1);
    await expect(cache.get("channel")).resolves.toBeUndefined();
    await cache.set("channel", { value: 1 });
    await expect(cache.get("channel")).resolves.toEqual({ value: 1 });
    await cache.set("channel", { value: 2 });
    await expect(cache.get("channel")).resolves.toEqual({ value: 2 });
    await cache.delete("channel");
    await cache.delete("channel");
    await expect(cache.get("channel")).resolves.toBeUndefined();
  });

  it("evicts the least recently used entry and promotes reads", async () => {
    const cache = new MemoryCacheStorage({ maxEntries: 2 });
    await cache.write("a", "first");
    await cache.write("b", "second");
    await cache.read("a");
    await cache.write("c", "third");
    await expect(cache.read("b")).resolves.toBeUndefined();
    await expect(cache.read("a")).resolves.toBe("first");
    await expect(cache.read("c")).resolves.toBe("third");
  });

  it("promotes replacements without consuming a second entry", async () => {
    const cache = new MemoryCacheStorage({ maxEntries: 2 });
    await cache.write("a", "first");
    await cache.write("b", "second");
    await cache.write("a", "updated");
    await expect(cache.read("b")).resolves.toBe("second");
    await cache.write("a", "updated again");
    await cache.write("c", "third");
    await expect(cache.read("b")).resolves.toBeUndefined();
    await expect(cache.read("a")).resolves.toBe("updated again");
  });

  it("counts both keys and UTF-8 values in the payload byte budget", async () => {
    const cache = new MemoryCacheStorage({ maxBytes: 6 });
    await cache.write("é", "🙂"); // 2 + 4 bytes, exactly the budget.
    await expect(cache.read("é")).resolves.toBe("🙂");
    await cache.write("b", "abc");
    await expect(cache.read("é")).resolves.toBeUndefined();
    await expect(cache.read("b")).resolves.toBe("abc");
    await cache.write("abcdefg", "");
    await expect(cache.read("abcdefg")).resolves.toBeUndefined();
    await expect(cache.read("b")).resolves.toBe("abc");
  });

  it("updates byte accounting correctly when values grow, shrink and are deleted", async () => {
    const cache = new MemoryCacheStorage({ maxBytes: 12 });
    await cache.write("a", "123");
    await cache.write("b", "456");
    await cache.write("c", "789");
    await cache.write("a", "12345"); // 6 + 4 + 4; evict oldest b.
    await expect(cache.read("b")).resolves.toBeUndefined();
    await expect(cache.read("c")).resolves.toBe("789");
    await cache.write("a", "1"); // Two bytes; six bytes now available.
    await cache.write("d", "12345");
    await expect(cache.read("c")).resolves.toBe("789");
    await cache.delete("d");
    await cache.delete("d");
    await cache.write("e", "12345");
    await expect(cache.read("a")).resolves.toBe("1");
    await expect(cache.read("c")).resolves.toBe("789");
    await expect(cache.read("e")).resolves.toBe("12345");
  });

  it("skips oversized replacements without retaining stale values or evicting unrelated entries", async () => {
    const cache = new MemoryCacheStorage({ maxBytes: 8 });
    await cache.write("a", "123");
    await cache.write("b", "45");
    await cache.write("a", "123456789");
    await expect(cache.read("a")).resolves.toBeUndefined();
    await expect(cache.read("b")).resolves.toBe("45");
    await cache.write("c", "6789");
    await expect(cache.read("b")).resolves.toBe("45");
    await expect(cache.read("c")).resolves.toBe("6789");
  });

  it("enforces the default 512-entry bound and does not persist across instances", async () => {
    const cache = new MemoryCacheStorage();
    for (let index = 0; index < 513; index += 1)
      await cache.write(String(index), "value");
    await expect(cache.read("0")).resolves.toBeUndefined();
    await expect(cache.read("1")).resolves.toBe("value");
    await expect(cache.read("512")).resolves.toBe("value");
    await expect(new MemoryCacheStorage().read("512")).resolves.toBeUndefined();
  });

  it("skips entries exceeding the default two MiB payload budget", async () => {
    const cache = new MemoryCacheStorage();
    await cache.write("small", "kept");
    await cache.write("large", "x".repeat(2 * 1024 * 1024));
    await expect(cache.read("large")).resolves.toBeUndefined();
    await expect(cache.read("small")).resolves.toBe("kept");
  });

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid limits %s",
    (limit) => {
      expect(() => new MemoryCacheStorage({ maxEntries: limit })).toThrow(
        RangeError,
      );
      expect(() => new MemoryCacheStorage({ maxBytes: limit })).toThrow(
        RangeError,
      );
    },
  );
});
