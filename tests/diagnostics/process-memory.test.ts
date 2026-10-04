import { describe, expect, it, vi } from "vitest";

import { ProcessMemoryDiagnostics } from "../../src/diagnostics/process-memory";

const sample = {
  rss: 94_000_000,
  heapTotal: 45_000_000,
  heapUsed: 31_000_000,
  external: 4_000_000,
  arrayBuffers: 700_000,
};

describe("process memory diagnostics", () => {
  it("samples current process memory and uptime on demand", () => {
    const sampler = vi
      .fn()
      .mockReturnValueOnce(sample)
      .mockReturnValueOnce({ ...sample, heapUsed: 32_000_000 });
    const clock = vi
      .fn()
      .mockReturnValueOnce(120.5)
      .mockReturnValueOnce(123.75);
    const diagnostics = new ProcessMemoryDiagnostics({ sampler, clock });
    expect(sampler).not.toHaveBeenCalled();
    expect(diagnostics.snapshot()).toEqual({
      ...sample,
      uptimeSeconds: 120.5,
      warningCount: 0,
    });
    expect(diagnostics.snapshot()).toEqual({
      ...sample,
      heapUsed: 32_000_000,
      uptimeSeconds: 123.75,
      warningCount: 0,
    });
  });

  it("keeps only the latest warning and never retains raw events or private fields", () => {
    let uptime = 10;
    const diagnostics = new ProcessMemoryDiagnostics({
      sampler: () => ({
        ...sample,
        env: { password: "sample-secret" },
        execArgv: ["private-argument"],
      }),
      clock: () => uptime,
    });
    const first = {
      count: 2,
      limit: 100,
      token: "warning-secret",
      names: ["Living room"],
    };
    diagnostics.onWarning(first);
    first.count = 999;
    first.limit = 999;
    expect(diagnostics.snapshot()).toMatchObject({
      warningCount: 1,
      lastWarning: { count: 2, limit: 100, uptimeSeconds: 10 },
    });
    uptime = 20;
    diagnostics.onWarning({
      count: 3,
      limit: 128.5,
      credentials: "later-secret",
    });
    uptime = 30;
    const result = diagnostics.snapshot();
    expect(result).toEqual({
      ...sample,
      uptimeSeconds: 30,
      warningCount: 2,
      lastWarning: { count: 3, limit: 128.5, uptimeSeconds: 20 },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /secret|private|Living room|credentials|execArgv|token|env/,
    );
  });

  it("returns detached warning snapshots rather than exposing internal mutable state", () => {
    const diagnostics = new ProcessMemoryDiagnostics({
      sampler: () => sample,
      clock: () => 5,
    });
    diagnostics.onWarning({ count: 1, limit: 128 });
    const first = diagnostics.snapshot();
    if (!first.lastWarning) throw new Error("Missing warning");
    Object.defineProperty(first.lastWarning, "count", { value: 999 });
    expect(diagnostics.snapshot().lastWarning?.count).toBe(1);
  });

  it("counts malformed notifications but drops invalid numbers without coercion", () => {
    const diagnostics = new ProcessMemoryDiagnostics({
      sampler: () => ({
        rss: "100",
        heapTotal: NaN,
        heapUsed: -1,
        external: Infinity,
        arrayBuffers: 0.5,
      }),
      clock: () => -1,
    });
    for (const payload of [
      undefined,
      null,
      "secret",
      [1, 2],
      { count: "4", limit: NaN },
    ])
      diagnostics.onWarning(payload);
    expect(diagnostics.snapshot()).toEqual({
      warningCount: 5,
      lastWarning: {},
    });
    diagnostics.onWarning({ count: 0.5, limit: Number.MAX_SAFE_INTEGER + 1 });
    expect(diagnostics.snapshot()).toEqual({
      warningCount: 6,
      lastWarning: {},
    });
  });

  it("does not reuse prior warning fields when the newest payload omits them", () => {
    const diagnostics = new ProcessMemoryDiagnostics({
      sampler: () => ({}),
      clock: () => 9,
    });
    diagnostics.onWarning({ count: 1, limit: 128 });
    diagnostics.onWarning(undefined);
    expect(diagnostics.snapshot()).toEqual({
      uptimeSeconds: 9,
      warningCount: 2,
      lastWarning: { uptimeSeconds: 9 },
    });
  });

  it("ignores inherited properties, getters and hostile proxies without executing getters", () => {
    const getter = vi.fn(() => {
      throw new Error("private getter");
    });
    const payload: object = Object.create({ count: 10, limit: 128 }) as object;
    Object.defineProperty(payload, "count", { get: getter });
    const proxy = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error("private proxy");
        },
      },
    );
    const diagnostics = new ProcessMemoryDiagnostics({
      sampler: () => proxy,
      clock: () => 0,
    });
    diagnostics.onWarning(payload);
    expect(diagnostics.snapshot()).toEqual({
      uptimeSeconds: 0,
      warningCount: 1,
      lastWarning: { uptimeSeconds: 0 },
    });
    diagnostics.onWarning(proxy);
    expect(() => diagnostics.snapshot()).not.toThrow();
    expect(getter).not.toHaveBeenCalled();
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(() => diagnostics.onWarning(revoked.proxy)).not.toThrow();
  });

  it("survives unavailable samplers and clocks without exporting exception messages", () => {
    const diagnostics = new ProcessMemoryDiagnostics({
      sampler: () => {
        throw new Error("private sampler credentials");
      },
      clock: () => {
        throw new Error("private clock configuration");
      },
    });
    diagnostics.onWarning({ count: 1, limit: 128 });
    expect(diagnostics.snapshot()).toEqual({
      warningCount: 1,
      lastWarning: { count: 1, limit: 128 },
    });
  });

  it("retains a constant size of data after many warning events", () => {
    const diagnostics = new ProcessMemoryDiagnostics({
      sampler: () => sample,
      clock: () => 1,
    });
    for (let index = 0; index < 10_000; index++)
      diagnostics.onWarning({
        count: index,
        limit: 128,
        details: "private".repeat(100),
      });
    const result = diagnostics.snapshot();
    expect(result.warningCount).toBe(10_000);
    expect(result.lastWarning?.count).toBe(9999);
    expect(Object.keys(result)).toHaveLength(8);
    expect(JSON.stringify(result).length).toBeLessThan(300);
  });

  it("defaults to a current Node.js process sample without registering background work", () => {
    const result = new ProcessMemoryDiagnostics().snapshot();
    expect(result.rss).toBeGreaterThan(0);
    expect(result.heapUsed).toBeGreaterThan(0);
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(result.warningCount).toBe(0);
    expect(result.lastWarning).toBeUndefined();
  });
});
