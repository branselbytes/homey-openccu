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

  it.each([
    ["up", "LEVEL", 1],
    ["down", "LEVEL", 0],
    ["idle", "STOP", true],
  ] as const)(
    "maps Homey cover state %s to OpenCCU %s",
    async (state, parameter, value) => {
      const setValue = vi.fn();
      const client = { ...createClient(), setValue };
      const runtime = new OpenCcuRuntime(client, {
        centralId: "ccu-1",
        interfaceId: "HmIP-RF",
      });

      await runtime.write(
        {
          capability: "windowcoverings_state",
          channelAddress: "301:3",
          parameter: "ACTIVITY_STATE",
          writeChannelAddress: "301:4",
          writeParameter: "LEVEL",
          writeStrategy: "cover-state",
          readable: true,
          writable: true,
          transform: "activity-state-to-cover-state",
        },
        state,
      );

      expect(setValue).toHaveBeenCalledWith(
        "301:4",
        parameter,
        value,
        undefined,
      );
    },
  );

  it.each([
    [true, "CLOSE"],
    [false, "OPEN"],
  ] as const)(
    "maps Homey garage closed=%s to OpenCCU %s",
    async (closed, command) => {
      const setValue = vi.fn();
      const runtime = new OpenCcuRuntime(
        { ...createClient(), setValue },
        { centralId: "ccu-1", interfaceId: "HmIP-RF" },
      );
      await runtime.write(
        {
          capability: "garagedoor_closed",
          channelAddress: "401:1",
          parameter: "DOOR_STATE",
          writeChannelAddress: "401:1",
          writeParameter: "DOOR_COMMAND",
          writeStrategy: "garage-closed",
          readable: true,
          writable: true,
          transform: "garage-door-state-to-closed",
        },
        closed,
      );
      expect(setValue).toHaveBeenCalledWith(
        "401:1",
        "DOOR_COMMAND",
        command,
        undefined,
      );
    },
  );

  it.each([
    [
      true,
      {
        ACOUSTIC_ALARM_SELECTION: "FREQUENCY_RISING_AND_FALLING",
        OPTICAL_ALARM_SELECTION: "BLINKING_ALTERNATELY_REPEATING",
        DURATION_UNIT: "S",
        DURATION_VALUE: 30,
      },
    ],
    [
      false,
      {
        ACOUSTIC_ALARM_SELECTION: "DISABLE_ACOUSTIC_SIGNAL",
        OPTICAL_ALARM_SELECTION: "DISABLE_OPTICAL_SIGNAL",
        DURATION_UNIT: "S",
        DURATION_VALUE: 0,
      },
    ],
  ] as const)(
    "writes the default HmIP siren state %s atomically",
    async (enabled, values) => {
      const putParamset = vi.fn();
      const runtime = new OpenCcuRuntime(
        { ...createClient(), putParamset },
        { centralId: "ccu-1", interfaceId: "HmIP-RF" },
      );
      await runtime.write(
        {
          capability: "onoff",
          channelAddress: "701:3",
          parameter: "ACOUSTIC_ALARM_ACTIVE",
          writeChannelAddress: "701:3",
          writeParameter: "ACOUSTIC_ALARM_SELECTION",
          writeStrategy: "siren-default",
          readable: true,
          writable: true,
          transform: "boolean",
        },
        enabled,
      );
      expect(putParamset).toHaveBeenCalledWith(
        "701:3",
        "VALUES",
        values,
        undefined,
      );
    },
  );

  it.each([
    [true, "INTRUSION_ALARM"],
    [false, "INTRUSION_ALARM_OFF"],
  ] as const)(
    "maps the smoke detector siren state %s to %s",
    async (enabled, command) => {
      const setValue = vi.fn();
      const runtime = new OpenCcuRuntime(
        { ...createClient(), setValue },
        { centralId: "ccu-1", interfaceId: "HmIP-RF" },
      );
      await runtime.write(
        {
          capability: "onoff",
          channelAddress: "801:1",
          parameter: "SMOKE_DETECTOR_ALARM_STATUS",
          writeChannelAddress: "801:1",
          writeParameter: "SMOKE_DETECTOR_COMMAND",
          writeStrategy: "smoke-siren",
          readable: true,
          writable: true,
          transform: "smoke-status-to-boolean",
        },
        enabled,
      );
      expect(setValue).toHaveBeenCalledWith(
        "801:1",
        "SMOKE_DETECTOR_COMMAND",
        command,
        undefined,
      );
    },
  );
});
