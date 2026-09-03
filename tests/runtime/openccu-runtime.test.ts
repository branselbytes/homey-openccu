import { describe, expect, it, vi } from "vitest";

import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import type { XmlRpcClient } from "../../src/protocol/xmlrpc/types";

function createClient(): XmlRpcClient {
  return {
    listDevices: vi.fn().mockResolvedValue([
      { ADDRESS: "301", TYPE: "HmIP-PS", CHILDREN: ["301:3"] },
      {
        ADDRESS: "301:3",
        TYPE: "SWITCH",
        PARENT: "301",
        PARAMSETS: ["VALUES"],
      },
    ]),
    getParamsetDescription: vi.fn().mockResolvedValue({
      STATE: { TYPE: "BOOL", OPERATIONS: 7, FLAGS: 1 },
    }),
    getValue: vi.fn(),
    getParamset: vi.fn().mockResolvedValue({ STATE: true }),
    setValue: vi.fn(),
    putParamset: vi.fn(),
    init: vi.fn(),
  };
}

describe("OpenCcuRuntime", () => {
  it("retains the latest connection state for late subscribers", () => {
    const runtime = new OpenCcuRuntime(createClient(), {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });

    expect(runtime.connectionState).toBe("stopped");
    runtime.publishConnectionState("connecting");
    expect(runtime.connectionState).toBe("connecting");
    runtime.publishConnectionState("healthy");
    expect(runtime.connectionState).toBe("healthy");
    expect(runtime.getDiagnostics()).toMatchObject({
      connectionState: "healthy",
      deviceCount: 0,
      discoveryIssueCount: 0,
    });
  });

  it("provides pairing candidates only after a successful refresh", async () => {
    const runtime = new OpenCcuRuntime(createClient(), {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    expect(runtime.pairingCandidates()).toEqual([]);

    await runtime.refresh();

    expect(
      runtime.pairingCandidates(new Map([["301", "Licht"]])),
    ).toMatchObject([
      { driverId: "HMIP-PS", name: "Licht", capabilities: ["onoff"] },
    ]);
  });

  it("routes callback events through listener-specific subscriptions", async () => {
    const runtime = new OpenCcuRuntime(createClient(), {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });
    const listener = vi.fn();
    const unsubscribe = runtime.subscribe("datapoint", listener);
    const dispatcher = runtime.createCallbackDispatcher();

    await dispatcher.dispatch("event", ["HmIP-RF", "301:3", "STATE", true]);
    unsubscribe();
    await dispatcher.dispatch("event", ["HmIP-RF", "301:3", "STATE", false]);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      interfaceId: "HmIP-RF",
      channelAddress: "301:3",
      parameter: "STATE",
      value: true,
    });
  });
});
