import { describe, expect, it, vi } from "vitest";

import { loadOpenCcuServiceMessages } from "../../src/protocol/jsonrpc/service-messages";

describe("OpenCCU service messages", () => {
  it("runs a read-only ReGa query and normalizes active messages", async () => {
    const call = vi.fn().mockResolvedValue(
      JSON.stringify([
        {
          id: "42",
          name: "AL-3014F711A000000000000001%3A0.LOW%5FBAT",
          type: 0,
          address: "3014F711A000000000000001:0",
          device_name: "T%FCrkontakt",
          timestamp: "2026-09-05 12:10:00",
          last_timestamp: "2026-09-05 12:12:00",
          counter: 2,
        },
      ]),
    );

    await expect(loadOpenCcuServiceMessages({ call })).resolves.toEqual([
      {
        id: "42",
        code: "LOW_BAT",
        type: 0,
        address: "3014F711A000000000000001:0",
        deviceName: "Türkontakt",
        occurredAt: "2026-09-05 12:10:00",
        lastOccurredAt: "2026-09-05 12:12:00",
        occurrenceCount: 2,
      },
    ]);
    expect(call).toHaveBeenCalledOnce();
    const invocation = call.mock.calls[0] as unknown as [
      string,
      { readonly script: string },
      undefined,
    ];
    expect(invocation[0]).toBe("ReGa.runScript");
    expect(invocation[1].script).toContain("ID_SERVICES");
    expect(invocation[2]).toBeUndefined();
  });

  it("rejects malformed script output and skips malformed entries", async () => {
    await expect(
      loadOpenCcuServiceMessages({
        call: vi.fn().mockResolvedValue("not json"),
      }),
    ).rejects.toThrow("not valid JSON");
    await expect(
      loadOpenCcuServiceMessages({
        call: vi
          .fn()
          .mockResolvedValue([null, { id: 1 }, { id: "1", name: "UNREACH" }]),
      }),
    ).resolves.toEqual([
      { id: "1", code: "UNREACH", type: 0, occurrenceCount: 0 },
    ]);
  });
});
