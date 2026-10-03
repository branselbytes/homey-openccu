import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { DeviceBindingController } from "../../src/homey/device-binding-controller";
import type { CapabilityBinding } from "../../src/mapping/types";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";

interface Recording {
  description: DeviceDescription;
  channels: {
    description: DeviceDescription;
    parameters: ParamsetDescription;
  }[];
}
const recordings = JSON.parse(
  readFileSync("tests/fixtures/device-families.json", "utf8"),
) as Recording[];
const CAPABILITIES = [
  "alarm_battery",
  "measure_temperature",
  "target_temperature",
  "homematic_thermostat_mode",
  "homematic_thermostat_boost",
  "homematic_thermostat_weekprofile",
  "homematic_measure_valve",
];

// The recorded fixtures contain actual metadata only. All runtime values/events
// below are synthetic; unrecorded variants also use synthetic metadata.
function syntheticRecording(deviceType: string): Recording {
  const address = "ETRV-FIXTURE";
  return {
    description: {
      ADDRESS: address,
      TYPE: deviceType,
      CHILDREN: [`${address}:0`, `${address}:1`],
    },
    channels: [
      {
        description: {
          ADDRESS: `${address}:0`,
          TYPE: "MAINTENANCE",
          PARENT: address,
          PARAMSETS: ["VALUES"],
        },
        parameters: { LOW_BAT: { TYPE: "BOOL", OPERATIONS: 5, FLAGS: 1 } },
      },
      {
        description: {
          ADDRESS: `${address}:1`,
          TYPE: "HEATING_CLIMATECONTROL_TRANSCEIVER",
          PARENT: address,
          PARAMSETS: ["VALUES"],
        },
        parameters: {
          ACTUAL_TEMPERATURE: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
          SET_POINT_TEMPERATURE: { TYPE: "FLOAT", OPERATIONS: 7, FLAGS: 1 },
          SET_POINT_MODE: { TYPE: "INTEGER", OPERATIONS: 7, FLAGS: 1 },
          CONTROL_MODE: { TYPE: "INTEGER", OPERATIONS: 2, FLAGS: 1 },
          BOOST_MODE: { TYPE: "BOOL", OPERATIONS: 6, FLAGS: 1 },
          ACTIVE_PROFILE: { TYPE: "INTEGER", OPERATIONS: 7, FLAGS: 1 },
          LEVEL: { TYPE: "FLOAT", OPERATIONS: 7, FLAGS: 1 },
        },
      },
    ],
  };
}

function createFixture(recording: Recording) {
  const address = recording.description.ADDRESS;
  const parameters = new Map(
    recording.channels.map((channel) => [
      channel.description.ADDRESS,
      channel.parameters,
    ]),
  );
  const client = {
    listDevices: vi
      .fn()
      .mockResolvedValue([
        recording.description,
        ...recording.channels.map((channel) => channel.description),
      ]),
    getParamsetDescription: vi.fn((channel: string) =>
      Promise.resolve(parameters.get(channel) ?? {}),
    ),
    getParamset: vi.fn(
      (channel: string): Promise<Readonly<Record<string, RpcValue>>> =>
        Promise.resolve<Readonly<Record<string, RpcValue>>>(
          channel === `${address}:0`
            ? { LOW_BAT: false }
            : {
                ACTUAL_TEMPERATURE: 20.5,
                SET_POINT_TEMPERATURE: 21,
                SET_POINT_MODE: 0,
                ACTIVE_PROFILE: 1,
                LEVEL: 0.42,
              },
        ),
    ),
    getValue: vi.fn(),
    setValue: vi.fn().mockResolvedValue(undefined),
    putParamset: vi.fn(),
    init: vi.fn(),
  } satisfies XmlRpcClient;
  const runtime = new OpenCcuRuntime(client, {
    centralId: "ccu-1",
    interfaceId: "HmIP-RF",
  });
  return { client, runtime, address };
}

function createHomeyDevice() {
  return {
    getCapabilities: () => CAPABILITIES,
    addCapability: vi.fn(),
    removeCapability: vi.fn(),
    setCapabilityValue: vi.fn().mockResolvedValue(undefined),
    triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
    onCapabilityWrite: vi.fn(() => vi.fn()),
    setAvailable: vi.fn().mockResolvedValue(undefined),
    setUnavailable: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
  };
}

// Capture the pre-consolidation bindings explicitly rather than deriving the
// upgrade expectation from the current profile under test.
function legacyBindings(address: string): CapabilityBinding[] {
  return [
    {
      capability: "alarm_battery",
      channelAddress: `${address}:0`,
      parameter: "LOW_BAT",
      readable: true,
      writable: false,
      transform: "boolean",
    },
    {
      capability: "measure_temperature",
      channelAddress: `${address}:1`,
      parameter: "ACTUAL_TEMPERATURE",
      readable: true,
      writable: false,
      transform: "identity",
    },
    ...(
      [
        [
          "target_temperature",
          "SET_POINT_TEMPERATURE",
          "SET_POINT_TEMPERATURE",
          "identity",
          true,
        ],
        [
          "homematic_thermostat_mode",
          "SET_POINT_MODE",
          "CONTROL_MODE",
          "enum-number-to-string",
          true,
        ],
        [
          "homematic_thermostat_boost",
          "BOOST_MODE",
          "BOOST_MODE",
          "identity",
          false,
        ],
        [
          "homematic_thermostat_weekprofile",
          "ACTIVE_PROFILE",
          "ACTIVE_PROFILE",
          "enum-number-to-string",
          true,
        ],
        ["homematic_measure_valve", "LEVEL", "LEVEL", "ratio-to-percent", true],
      ] as const
    ).map(([capability, parameter, writeParameter, transform, readable]) => ({
      capability,
      channelAddress: `${address}:1`,
      parameter,
      readable,
      writable: true,
      writeChannelAddress: `${address}:1`,
      writeParameter,
      transform,
    })),
  ];
}

const familyRecordings = [
  ...recordings.filter(({ description }) => description.TYPE?.includes("eTRV")),
  ...[
    "HMIP-eTRV",
    "HmIP-eTRV",
    "HmIP-eTRV-2",
    "HmIP-eTRV-B",
    "HmIP-eTRV-B-2",
    "HmIP-eTRV-C",
    "HmIP-eTRV-E",
  ].map(syntheticRecording),
];

describe("eTRV family discovery and upgrade", () => {
  it.each(
    familyRecordings.map(
      (recording) => [recording.description.TYPE, recording] as const,
    ),
  )(
    "preserves identity, bindings, commands and events for %s",
    async (deviceType, recording) => {
      const { client, runtime, address } = createFixture(recording);
      await runtime.refresh();
      expect(runtime.discoveryIssues).toEqual([]);
      const candidate = runtime.pairingCandidates()[0];
      expect(runtime.pairingCandidates()).toHaveLength(1);
      expect(candidate).toMatchObject({
        driverId: "HmIP-eTRV-2",
        data: { id: `ccu-1/HmIP-RF/${address}`, address },
        capabilities: CAPABILITIES,
        store: {
          deviceType,
          profileId: "hmip-radiator-thermostat",
          generic: false,
        },
      });
      const previousBindings = legacyBindings(address);
      expect(candidate.store.bindings).toEqual(previousBindings);
      const device = createHomeyDevice();
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
        expect(device.setCapabilityValue.mock.calls).toEqual([
          ["alarm_battery", false],
          ["measure_temperature", 20.5],
          ["target_temperature", 21],
          ["homematic_thermostat_mode", "0"],
          ["homematic_thermostat_weekprofile", "1"],
          ["homematic_measure_valve", 42],
        ]);
        device.setCapabilityValue.mockClear();
        for (const [parameter, value] of [
          ["SET_POINT_TEMPERATURE", 22],
          ["SET_POINT_MODE", 1],
          ["BOOST_MODE", true],
          ["ACTIVE_PROFILE", 2],
          ["LEVEL", 0.25],
        ] as const) {
          await runtime
            .createCallbackDispatcher()
            .dispatch("event", ["HmIP-RF", `${address}:1`, parameter, value]);
        }
        expect(device.setCapabilityValue.mock.calls).toEqual([
          ["target_temperature", 22],
          ["homematic_thermostat_mode", "1"],
          ["homematic_thermostat_boost", true],
          ["homematic_thermostat_weekprofile", "2"],
          ["homematic_measure_valve", 25],
        ]);
        const commands: readonly (readonly [
          string,
          RpcValue,
          string,
          RpcValue,
        ])[] = [
          ["target_temperature", 22, "SET_POINT_TEMPERATURE", 22],
          ["homematic_thermostat_mode", "1", "CONTROL_MODE", 1],
          ["homematic_thermostat_boost", true, "BOOST_MODE", true],
          ["homematic_thermostat_weekprofile", "2", "ACTIVE_PROFILE", 2],
        ];
        for (const [capability, value, parameter, expected] of commands) {
          const binding = candidate.store.bindings.find(
            (binding) => binding.capability === capability,
          )!;
          await runtime.write(binding, value);
          expect(client.setValue).toHaveBeenLastCalledWith(
            `${address}:1`,
            parameter,
            expected,
            undefined,
          );
        }
        expect(device.error).not.toHaveBeenCalled();
      } finally {
        controller.stop();
      }
    },
  );

  it("only exposes the capabilities actually discovered on a thermostat", async () => {
    const recording = syntheticRecording("HmIP-eTRV-B");
    recording.channels[0].parameters = {};
    recording.channels[1].parameters = {
      ACTUAL_TEMPERATURE: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
      SET_POINT_TEMPERATURE: { TYPE: "FLOAT", OPERATIONS: 7, FLAGS: 1 },
    };
    const { runtime } = createFixture(recording);
    await runtime.refresh();
    expect(runtime.pairingCandidates()).toMatchObject([
      {
        driverId: "HmIP-eTRV-2",
        capabilities: ["measure_temperature", "target_temperature"],
      },
    ]);
  });

  it("keeps unknown eTRV suffix variants on generic discovery", async () => {
    const { runtime } = createFixture(syntheticRecording("HmIP-eTRV-X"));
    await runtime.refresh();
    expect(runtime.pairingCandidates()).toMatchObject([
      { driverId: "openccu-generic", store: { generic: true } },
    ]);
  });
});
