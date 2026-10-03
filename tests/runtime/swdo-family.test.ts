import { describe, expect, it, vi } from "vitest";

import { DeviceBindingController } from "../../src/homey/device-binding-controller";
import type { CapabilityBinding } from "../../src/mapping/types";
import type {
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";

const ADDRESS = "SWDO-FIXTURE";
const CAPABILITIES = ["alarm_contact", "alarm_battery"];

// Dedicated synthetic fixture; these responses are not a hardware recording.
function createFixture(deviceType: string, withBattery = true) {
  const descriptions = new Map<string, ParamsetDescription>([
    [
      `${ADDRESS}:0`,
      withBattery ? { LOW_BAT: { TYPE: "BOOL", OPERATIONS: 5, FLAGS: 1 } } : {},
    ],
    [`${ADDRESS}:1`, { STATE: { TYPE: "BOOL", OPERATIONS: 5, FLAGS: 1 } }],
  ]);
  const values = new Map<string, Readonly<Record<string, RpcValue>>>([
    [`${ADDRESS}:0`, withBattery ? { LOW_BAT: false } : {}],
    [`${ADDRESS}:1`, { STATE: false }],
  ]);
  const client = {
    listDevices: vi.fn().mockResolvedValue([
      {
        ADDRESS,
        TYPE: deviceType,
        CHILDREN: [`${ADDRESS}:0`, `${ADDRESS}:1`],
      },
      {
        ADDRESS: `${ADDRESS}:0`,
        TYPE: "MAINTENANCE",
        PARENT: ADDRESS,
        PARAMSETS: ["VALUES"],
      },
      {
        ADDRESS: `${ADDRESS}:1`,
        TYPE: "SHUTTER_CONTACT",
        PARENT: ADDRESS,
        PARAMSETS: ["VALUES"],
      },
    ]),
    getParamsetDescription: vi.fn((address: string) =>
      Promise.resolve(descriptions.get(address) ?? {}),
    ),
    getParamset: vi.fn((address: string) =>
      Promise.resolve(values.get(address) ?? {}),
    ),
    getValue: vi.fn(),
    setValue: vi.fn(),
    putParamset: vi.fn(),
    init: vi.fn(),
  } satisfies XmlRpcClient;
  const runtime = new OpenCcuRuntime(client, {
    centralId: "ccu-1",
    interfaceId: "HmIP-RF",
  });
  return { client, runtime };
}

function createHomeyDevice(initialCapabilities: readonly string[] = []) {
  const capabilities = new Set(initialCapabilities);
  return {
    getCapabilities: () => [...capabilities],
    addCapability: vi.fn((capability: string) => {
      capabilities.add(capability);
      return Promise.resolve();
    }),
    removeCapability: vi.fn((capability: string) => {
      capabilities.delete(capability);
      return Promise.resolve();
    }),
    setCapabilityValue: vi.fn().mockResolvedValue(undefined),
    triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
    onCapabilityWrite: vi.fn(),
    setAvailable: vi.fn().mockResolvedValue(undefined),
    setUnavailable: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
  };
}

describe("SWDO family fixture integration", () => {
  it.each([
    "HMIP-SWDO",
    "HmIP-SWDO",
    "HmIP-SWDO-2",
    "HmIP-SWDO-I",
    "HmIP-SWDO-A",
    "HMIP-SWDO-A",
    "HmIP-SWDO-A 2.0",
  ])(
    "discovers, pairs, reads and receives events for %s through the shared driver",
    async (deviceType) => {
      const { client, runtime } = createFixture(deviceType);
      await runtime.refresh();

      expect(runtime.discoveryIssues).toEqual([]);
      const candidates = runtime.pairingCandidates();
      expect(candidates).toHaveLength(1);
      const candidate = candidates[0];
      expect(candidate).toMatchObject({
        driverId: "HMIP-SWDO",
        data: {
          id: `ccu-1/HmIP-RF/${ADDRESS}`,
          centralId: "ccu-1",
          interfaceId: "HmIP-RF",
          address: ADDRESS,
        },
        capabilities: CAPABILITIES,
        store: { deviceType, profileId: "hmip-contact", generic: false },
      });
      expect(candidate.store.bindings).toMatchObject([
        {
          capability: "alarm_contact",
          channelAddress: `${ADDRESS}:1`,
          parameter: "STATE",
          readable: true,
          writable: false,
          transform: "boolean",
        },
        {
          capability: "alarm_battery",
          channelAddress: `${ADDRESS}:0`,
          parameter: "LOW_BAT",
          readable: true,
          writable: false,
          transform: "boolean",
        },
      ]);
      await runtime.refresh();
      expect(runtime.pairingCandidates()[0]?.data).toEqual(candidate.data);

      runtime.publishConnectionState("healthy");
      const device = createHomeyDevice();
      const controller = new DeviceBindingController(
        runtime,
        device,
        candidate.store.bindings,
      );
      try {
        await controller.start();
        expect(device.getCapabilities()).toEqual(CAPABILITIES);
        expect(client.getParamset).toHaveBeenCalledWith(
          `${ADDRESS}:1`,
          "VALUES",
          undefined,
        );
        expect(client.getParamset).toHaveBeenCalledWith(
          `${ADDRESS}:0`,
          "VALUES",
          undefined,
        );
        expect(device.setCapabilityValue.mock.calls).toEqual([
          ["alarm_contact", false],
          ["alarm_battery", false],
        ]);

        device.setCapabilityValue.mockClear();
        const dispatcher = runtime.createCallbackDispatcher();
        for (const [channel, parameter, value] of [
          [1, "STATE", true],
          [1, "STATE", false],
          [0, "LOW_BAT", true],
          [0, "LOW_BAT", false],
        ] as const) {
          await dispatcher.dispatch("event", [
            "HmIP-RF",
            `${ADDRESS}:${channel}`,
            parameter,
            value,
          ]);
        }
        expect(device.setCapabilityValue.mock.calls).toEqual([
          ["alarm_contact", true],
          ["alarm_contact", false],
          ["alarm_battery", true],
          ["alarm_battery", false],
        ]);
        expect(device.onCapabilityWrite).not.toHaveBeenCalled();
        expect(client.setValue).not.toHaveBeenCalled();
        expect(device.error).not.toHaveBeenCalled();
      } finally {
        controller.stop();
      }
    },
  );

  it("does not claim an unknown SWDO variant as a supported family member", async () => {
    const { runtime } = createFixture("HmIP-SWDO-X");
    await runtime.refresh();

    expect(runtime.pairingCandidates()).toMatchObject([
      { driverId: "openccu-generic", store: { generic: true } },
    ]);
  });

  it("only exposes a battery alarm when LOW_BAT is discovered", async () => {
    const { runtime } = createFixture("HmIP-SWDO-A", false);
    await runtime.refresh();

    expect(runtime.pairingCandidates()).toMatchObject([
      { driverId: "HMIP-SWDO", capabilities: ["alarm_contact"] },
    ]);
  });

  it.each(["HmIP-SWDO-2", "HmIP-SWDO-I"])(
    "preserves stored bindings and capabilities of an existing %s device",
    async (deviceType) => {
      const { runtime } = createFixture(deviceType);
      await runtime.refresh();
      runtime.publishConnectionState("healthy");
      const storedBindings: readonly CapabilityBinding[] = [
        {
          capability: "alarm_contact",
          channelAddress: `${ADDRESS}:1`,
          parameter: "STATE",
          readable: true,
          writable: false,
          transform: "boolean",
        },
        {
          capability: "alarm_battery",
          channelAddress: `${ADDRESS}:0`,
          parameter: "LOW_BAT",
          readable: true,
          writable: false,
          transform: "boolean",
        },
      ];
      const device = createHomeyDevice(CAPABILITIES);
      const persistBindings = vi.fn().mockResolvedValue(undefined);
      const controller = new DeviceBindingController(
        runtime,
        device,
        storedBindings,
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
        await runtime
          .createCallbackDispatcher()
          .dispatch("event", ["HmIP-RF", `${ADDRESS}:1`, "STATE", true]);
        expect(device.setCapabilityValue).toHaveBeenLastCalledWith(
          "alarm_contact",
          true,
        );
        expect(device.error).not.toHaveBeenCalled();
      } finally {
        controller.stop();
      }
    },
  );
});
