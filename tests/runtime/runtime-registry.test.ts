import { describe, expect, it, vi } from "vitest";

import { RuntimeRegistry } from "../../src/runtime/runtime-registry";

describe("RuntimeRegistry", () => {
  it("stops a replaced runtime before publishing its replacement", async () => {
    const registry = new RuntimeRegistry<{ stop: () => Promise<void> }>();
    const first = { stop: vi.fn().mockResolvedValue(undefined) };
    const second = { stop: vi.fn().mockResolvedValue(undefined) };

    await registry.replace("ccu-1", first);
    await registry.replace("ccu-1", second);

    expect(first.stop).toHaveBeenCalledOnce();
    expect(registry.get("ccu-1")).toBe(second);
  });

  it("attempts to stop every runtime and aggregates shutdown failures", async () => {
    const registry = new RuntimeRegistry<{ stop: () => Promise<void> }>();
    const failing = { stop: vi.fn().mockRejectedValue(new Error("failed")) };
    const healthy = { stop: vi.fn().mockResolvedValue(undefined) };
    await registry.replace("ccu-1", failing);
    await registry.replace("ccu-2", healthy);

    await expect(registry.stopAll()).rejects.toThrow(AggregateError);

    expect(healthy.stop).toHaveBeenCalledOnce();
    expect(registry.size).toBe(0);
  });
});
