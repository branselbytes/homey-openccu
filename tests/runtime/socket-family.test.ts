import { describe, expect, it, vi } from "vitest";

import { DeviceBindingController } from "../../src/homey/device-binding-controller";
import type { CapabilityBinding } from "../../src/mapping/types";
import type {
  ParamsetDescription,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";

// Synthetic metadata and values for the original PS/PSM models. The PSM-2
// physical/virtual channel behavior is covered by recorded-catalog.test.ts.
function fixture(deviceType: string) {
  const metering = deviceType.toUpperCase().includes("PSM");
  const address = "SOCKET-FIXTURE";
  const params = new Map<string, ParamsetDescription>([
    [`${address}:3`, { STATE: { TYPE: "BOOL", OPERATIONS: 7, FLAGS: 1 } }],
    ...(metering
      ? ([
          [
            `${address}:6`,
            {
              POWER: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
              VOLTAGE: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
              CURRENT: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
              ENERGY_COUNTER: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
            },
          ],
        ] as const)
      : []),
  ]);
  const client = {
    listDevices: vi.fn().mockResolvedValue([
      { ADDRESS: address, TYPE: deviceType, CHILDREN: [...params.keys()] },
      ...[...params.keys()].map((channel) => ({
        ADDRESS: channel,
        TYPE: channel.endsWith(":3") ? "SWITCH" : "POWERMETER",
        PARENT: address,
        PARAMSETS: ["VALUES"],
      })),
    ]),
    getParamsetDescription: vi.fn((channel: string) =>
      Promise.resolve(params.get(channel) ?? {}),
    ),
    getParamset: vi.fn().mockResolvedValue({
      STATE: true,
      POWER: 23,
      VOLTAGE: 230,
      CURRENT: 100,
      ENERGY_COUNTER: 1500,
    }),
    getValue: vi.fn(),
    setValue: vi.fn().mockResolvedValue(undefined),
    putParamset: vi.fn(),
    init: vi.fn(),
  } satisfies XmlRpcClient;
  const runtime = new OpenCcuRuntime(client, {
    centralId: "ccu-1",
    interfaceId: "HmIP-RF",
  });
  return { address, client, runtime, metering };
}

// Explicit pre-consolidation bindings prove no capability or channel migration
// is required for already-paired PS and PSM devices.
function legacyBindings(
  address: string,
  metering: boolean,
): CapabilityBinding[] {
  return [
    {
      capability: "onoff",
      channelAddress: `${address}:3`,
      parameter: "STATE",
      readable: true,
      writable: true,
      writeChannelAddress: `${address}:3`,
      writeParameter: "STATE",
      transform: "identity",
    },
    ...(metering
      ? (
          [
            ["measure_power", "POWER", "identity"],
            ["measure_voltage", "VOLTAGE", "identity"],
            ["measure_current", "CURRENT", "milliamp-to-amp"],
            ["meter_power", "ENERGY_COUNTER", "watt-hour-to-kilowatt-hour"],
          ] as const
        ).map(([capability, parameter, transform]) => ({
          capability,
          channelAddress: `${address}:6`,
          parameter,
          readable: true,
          writable: false,
          transform,
        }))
      : []),
  ];
}

describe("socket family discovery and upgrade", () => {
  it.each(["HMIP-PS", "HmIP-PS", "HMIP-PSM", "HmIP-PSM"])(
    "preserves identity, capabilities, command and event channels for %s",
    async (deviceType) => {
      const { address, client, runtime, metering } = fixture(deviceType);
      await runtime.refresh();
      expect(runtime.discoveryIssues).toEqual([]);
      expect(runtime.pairingCandidates()).toHaveLength(1);
      const candidate = runtime.pairingCandidates()[0];
      const previousBindings = legacyBindings(address, metering);
      expect(candidate).toMatchObject({
        driverId: "HMIP-PSM",
        data: { id: `ccu-1/HmIP-RF/${address}`, address },
        capabilities: previousBindings.map(({ capability }) => capability),
        store: {
          deviceType,
          profileId: metering ? "hmip-power-meter-switch" : "hmip-switch",
          generic: false,
          bindings: previousBindings,
        },
      });
      const device = {
        getCapabilities: () =>
          previousBindings.map(({ capability }) => capability),
        addCapability: vi.fn(),
        removeCapability: vi.fn(),
        setCapabilityValue: vi.fn().mockResolvedValue(undefined),
        triggerButtonEvent: vi.fn(),
        onCapabilityWrite: vi.fn(() => vi.fn()),
        setAvailable: vi.fn().mockResolvedValue(undefined),
        setUnavailable: vi.fn(),
        log: vi.fn(),
        error: vi.fn(),
      };
      const persistBindings = vi.fn();
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(
        runtime,
        device,
        previousBindings,
        {
          resolveBindings: () => runtime.pairingCandidates()[0]?.store.bindings,
          persistBindings,
        },
      );
      try {
        await controller.start();
        expect(persistBindings).not.toHaveBeenCalled();
        expect(device.addCapability).not.toHaveBeenCalled();
        expect(device.removeCapability).not.toHaveBeenCalled();
        expect(device.setAvailable).toHaveBeenCalledOnce();
        expect(device.setCapabilityValue).toHaveBeenCalledWith("onoff", true);
        if (metering) {
          expect(device.setCapabilityValue).toHaveBeenCalledWith(
            "measure_current",
            0.1,
          );
          expect(device.setCapabilityValue).toHaveBeenCalledWith(
            "meter_power",
            1.5,
          );
        }
        device.setCapabilityValue.mockClear();
        await runtime
          .createCallbackDispatcher()
          .dispatch("event", ["HmIP-RF", `${address}:3`, "STATE", false]);
        expect(device.setCapabilityValue).toHaveBeenCalledWith("onoff", false);
        await runtime.write(candidate.store.bindings[0], true);
        expect(client.setValue).toHaveBeenCalledWith(
          `${address}:3`,
          "STATE",
          true,
          undefined,
        );
        expect(device.error).not.toHaveBeenCalled();
      } finally {
        controller.stop();
      }
    },
  );
});
