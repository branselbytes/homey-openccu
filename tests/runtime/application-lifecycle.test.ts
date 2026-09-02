import { describe, expect, it, vi } from "vitest";

import type { OpenCcuConnectionConfig } from "../../src/config/openccu-config";
import { OpenCcuApplicationLifecycle } from "../../src/runtime/application-lifecycle";

interface FakeRuntime {
  readonly id: string;
  stop(): Promise<void>;
}

function settingsWith(value: unknown): {
  get: () => unknown;
  set: (next: unknown) => void;
} {
  let stored = value;
  return {
    get: () => stored,
    set: (next) => {
      stored = next;
    },
  };
}

describe("OpenCcuApplicationLifecycle", () => {
  it("starts unconfigured and stops cleanly", async () => {
    const factory = { create: vi.fn() };
    const lifecycle = new OpenCcuApplicationLifecycle(
      settingsWith(undefined),
      factory,
    );

    await lifecycle.start();
    await lifecycle.stop();

    expect(factory.create).not.toHaveBeenCalled();
    expect(lifecycle.runtimeCount).toBe(0);
  });

  it("creates configured runtimes and replaces them on serialized reload", async () => {
    const settings = settingsWith([
      { centralId: "ccu-1", host: "openccu.local" },
    ]);
    const runtimes: Array<{
      runtime: FakeRuntime;
      stop: ReturnType<typeof vi.fn>;
    }> = [];
    const factory = {
      create: vi.fn((config: OpenCcuConnectionConfig): Promise<FakeRuntime> => {
        const runtime = {
          id: `${config.centralId}-${runtimes.length}`,
          stop: vi.fn(),
        };
        runtimes.push({ runtime, stop: runtime.stop });
        return Promise.resolve(runtime);
      }),
    };
    const lifecycle = new OpenCcuApplicationLifecycle(settings, factory);

    await lifecycle.start();
    settings.set([{ centralId: "ccu-1", host: "192.0.2.10" }]);
    await Promise.all([lifecycle.reload(), lifecycle.reload()]);

    expect(factory.create).toHaveBeenCalledTimes(3);
    expect(runtimes[0]?.stop).toHaveBeenCalledOnce();
    expect(runtimes[1]?.stop).toHaveBeenCalledOnce();
    expect(lifecycle.getRuntime("ccu-1")).toBe(runtimes[2]?.runtime);
  });

  it("preserves running state when settings validation fails", async () => {
    const settings = settingsWith([
      { centralId: "ccu-1", host: "openccu.local" },
    ]);
    const stop = vi.fn();
    const runtime: FakeRuntime = { id: "ccu-1", stop };
    const lifecycle = new OpenCcuApplicationLifecycle(settings, {
      create: vi.fn().mockResolvedValue(runtime),
    });
    await lifecycle.start();

    settings.set([{ centralId: "ccu-1", host: "http://invalid" }]);
    await expect(lifecycle.reload()).rejects.toThrow("protocol");

    expect(lifecycle.getRuntime("ccu-1")).toBe(runtime);
    expect(stop).not.toHaveBeenCalled();
  });

  it("removes runtimes no longer present in settings", async () => {
    const settings = settingsWith([
      { centralId: "ccu-1", host: "openccu.local" },
    ]);
    const stop = vi.fn();
    const runtime: FakeRuntime = { id: "ccu-1", stop };
    const lifecycle = new OpenCcuApplicationLifecycle(settings, {
      create: vi.fn().mockResolvedValue(runtime),
    });
    await lifecycle.start();

    settings.set([]);
    await lifecycle.reload();

    expect(stop).toHaveBeenCalledOnce();
    expect(lifecycle.runtimeCount).toBe(0);
  });
});
