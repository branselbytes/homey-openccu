import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { buildHmIpDeviceGraph } from "../../src/domain/model";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";
import { resolveDeviceMapping } from "../../src/mapping/device-resolver";
import { mapGenericDevice } from "../../src/mapping/generic-mapper";
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

function fixture(recordedType: string, alias = recordedType) {
  const recording = recordings.find(
    ({ description }) => description.TYPE === recordedType,
  );
  if (!recording) throw new Error(`Missing recorded type ${recordedType}`);
  const address = recording.description.ADDRESS;
  const descriptions = [
    { ...recording.description, TYPE: alias },
    ...recording.channels.map(({ description }) => description),
  ];
  const paramsets = new Map(
    recording.channels.map(({ description, parameters }) => [
      description.ADDRESS,
      parameters,
    ]),
  );
  // Datapoint descriptions are recorded; all values and callbacks are simulated.
  const values = new Map<string, Readonly<Record<string, RpcValue>>>([
    [`${address}:0`, { ACTUAL_TEMPERATURE: 23, LOW_BAT: false }],
    [
      `${address}:1`,
      {
        ACTUAL_TEMPERATURE: 20,
        HUMIDITY: 50,
        SET_POINT_TEMPERATURE: 21,
        SET_POINT_MODE: 0,
        BOOST_MODE: false,
        ACTIVE_PROFILE: 1,
        STATE: false,
      },
    ],
    [`${address}:2`, { STATE: false }],
    [`${address}:3`, { STATE: true }],
    [
      `${address}:6`,
      { POWER: 400, VOLTAGE: 230, CURRENT: 1000, ENERGY_COUNTER: 1250 },
    ],
  ]);
  const client = {
    listDevices: vi.fn().mockResolvedValue(descriptions),
    getParamsetDescription: vi.fn((channel: string) =>
      Promise.resolve(paramsets.get(channel) ?? {}),
    ),
    getParamset: vi.fn((channel: string) =>
      Promise.resolve(values.get(channel) ?? {}),
    ),
    getValue: vi.fn(),
    setValue: vi.fn().mockResolvedValue(undefined),
    putParamset: vi.fn(),
    init: vi.fn(),
  } satisfies XmlRpcClient;
  const device = buildHmIpDeviceGraph({
    centralId: "fixture",
    interfaceId: "HmIP-RF",
    descriptions,
    paramsets,
  }).get(address);
  if (!device) throw new Error("Missing recorded device");
  const runtime = new OpenCcuRuntime(client, {
    centralId: "fixture",
    interfaceId: "HmIP-RF",
  });
  return { address, device, client, runtime };
}

function homeyPort(capabilities: readonly string[]) {
  return {
    getCapabilities: () => [...capabilities],
    addCapability: vi.fn().mockResolvedValue(undefined),
    removeCapability: vi.fn().mockResolvedValue(undefined),
    setCapabilityValue: vi.fn().mockResolvedValue(undefined),
    triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
    onCapabilityWrite: vi.fn(() => vi.fn()),
    setAvailable: vi.fn().mockResolvedValue(undefined),
    setUnavailable: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
  };
}

describe("recorded catalog additions", () => {
  it.each(["HmIP-PSM-2", "HmIP-PSM-2-A", "HmIP-PSM-2 QHJ"])(
    "routes %s through the PSM family with physical feedback and virtual commands",
    async (type) => {
      const { address, device, runtime, client } = fixture("HmIP-PSM-2", type);
      await runtime.refresh();
      const candidate = runtime.pairingCandidates()[0];
      expect(candidate.driverId).toBe("HMIP-PSM");
      expect(candidate.data.id).toBe(`fixture/HmIP-RF/${address}`);
      const mapping = resolveDeviceMapping(device);
      const onoff = mapping.bindings.find(
        ({ capability }) => capability === "onoff",
      );
      if (!onoff) throw new Error("Missing switch binding");
      expect(onoff).toMatchObject({
        channelAddress: `${address}:2`,
        writeChannelAddress: `${address}:3`,
        parameter: "STATE",
        writeParameter: "STATE",
        readable: true,
        writable: true,
      });
      await expect(runtime.read(onoff)).resolves.toBe(false);
      await runtime.write(onoff, true);
      expect(client.setValue).toHaveBeenCalledWith(
        `${address}:3`,
        "STATE",
        true,
        undefined,
      );
      expect(client.setValue).not.toHaveBeenCalledWith(
        `${address}:2`,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      const oldBindings = mapGenericDevice(device);
      for (const binding of oldBindings)
        expect(mapping.bindings).toContainEqual(binding);
      expect(mapping.buttonEvents).toMatchObject([
        {
          channelAddress: `${address}:1`,
          parameter: "PRESS_SHORT",
          button: 1,
          pressType: "short",
        },
        {
          channelAddress: `${address}:1`,
          parameter: "PRESS_LONG",
          button: 1,
          pressType: "long",
        },
      ]);
    },
  );

  it("reads converted meter values and routes physical feedback and button events", async () => {
    const { address, device, runtime } = fixture("HmIP-PSM-2");
    const mapping = resolveDeviceMapping(device);
    runtime.publishConnectionState("healthy");
    const port = homeyPort(
      mapping.bindings.map(({ capability }) => capability),
    );
    const controller = new DeviceBindingController(
      runtime,
      port,
      mapping.bindings,
      { resolveButtonEvents: () => mapping.buttonEvents },
    );
    try {
      await controller.start();
      expect(port.setCapabilityValue.mock.calls).toEqual([
        ["onoff", false],
        ["measure_power", 400],
        ["measure_voltage", 230],
        ["measure_current", 1],
        ["meter_power", 1.25],
        ["measure_temperature", 23],
      ]);
      const dispatcher = runtime.createCallbackDispatcher();
      await dispatcher.dispatch("event", [
        "HmIP-RF",
        `${address}:3`,
        "STATE",
        true,
      ]);
      expect(port.setCapabilityValue).not.toHaveBeenCalledWith("onoff", true);
      await dispatcher.dispatch("event", [
        "HmIP-RF",
        `${address}:2`,
        "STATE",
        true,
      ]);
      expect(port.setCapabilityValue).toHaveBeenLastCalledWith("onoff", true);
      await dispatcher.dispatch("event", [
        "HmIP-RF",
        `${address}:1`,
        "PRESS_SHORT",
        true,
      ]);
      expect(port.triggerButtonEvent).toHaveBeenCalledWith(1, "short");
    } finally {
      controller.stop();
    }
  });

  it("requires a discovered writable virtual switch target", () => {
    const { address, device } = fixture("HmIP-PSM-2");
    const channels = new Map(device.channels);
    channels.delete(`${address}:3`);
    expect(
      resolveDeviceMapping({ ...device, channels }).bindings.map(
        ({ capability }) => capability,
      ),
    ).not.toContain("onoff");
  });

  it.each(["HmIPW-STH-A", "HmIPW-STH"])(
    "maps %s without losing generic capabilities",
    async (type) => {
      const { address, device, client, runtime } = fixture("HmIPW-STH-A", type);
      await runtime.refresh();
      const candidate = runtime.pairingCandidates()[0];
      expect(candidate).toMatchObject({
        driverId: "HmIPW-STH",
        data: { id: `fixture/HmIP-RF/${address}` },
        capabilities: [
          "measure_temperature",
          "measure_humidity",
          "target_temperature",
          "homematic_thermostat_boost",
        ],
      });
      const mapping = resolveDeviceMapping(device);
      for (const binding of mapGenericDevice(device))
        expect(mapping.bindings).toContainEqual(binding);
      const target = mapping.bindings.find(
        ({ capability }) => capability === "target_temperature",
      );
      if (!target) throw new Error("Missing setpoint binding");
      await expect(runtime.read(target)).resolves.toBe(21);
      await runtime.write(target, 19);
      expect(client.setValue).toHaveBeenCalledWith(
        `${address}:1`,
        "SET_POINT_TEMPERATURE",
        19,
        undefined,
      );
      // Do not truncate the Wired device's four modes and six week profiles
      // into the existing Homey enums intended for other thermostats.
      expect(candidate.capabilities).not.toContain("homematic_thermostat_mode");
      expect(candidate.capabilities).not.toContain(
        "homematic_thermostat_weekprofile",
      );
      const port = homeyPort(candidate.capabilities);
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(
        runtime,
        port,
        mapping.bindings,
      );
      try {
        await controller.start();
        await runtime
          .createCallbackDispatcher()
          .dispatch("event", [
            "HmIP-RF",
            `${address}:1`,
            "ACTUAL_TEMPERATURE",
            22.5,
          ]);
        expect(port.setCapabilityValue).toHaveBeenLastCalledWith(
          "measure_temperature",
          22.5,
        );
      } finally {
        controller.stop();
      }
    },
  );

  it.each(["HMIP-SWDO", "HmIP-SWDO-2", "HmIP-SWDO-A"])(
    "confirms real %s descriptions still match the contact family",
    (type) => {
      const { device } = fixture(type);
      const mapping = resolveDeviceMapping(device);
      expect(mapping.driverId).toBe("HMIP-SWDO");
      expect(mapping.bindings.map(({ capability }) => capability)).toEqual([
        "alarm_contact",
        "alarm_battery",
      ]);
      expect(
        mapping.bindings.every(
          ({ readable, writable }) => readable && !writable,
        ),
      ).toBe(true);
    },
  );
});
