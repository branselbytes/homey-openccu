import { describe, expect, it } from "vitest";

import type {
  OpenCcuChannel,
  OpenCcuDataPoint,
  OpenCcuDevice,
} from "../../src/domain/model";
import { ProfileRegistry } from "../../src/profiles/registry";

function powerSwitch(): OpenCcuDevice {
  const channels = new Map<string, OpenCcuChannel>();
  for (const [index, definitions] of [
    [3, [["STATE", "BOOL"]]],
    [
      6,
      [
        ["POWER", "FLOAT"],
        ["VOLTAGE", "FLOAT"],
        ["CURRENT", "FLOAT"],
        ["ENERGY_COUNTER", "FLOAT"],
      ],
    ],
  ] as const) {
    const address = `001:${index}`;
    const dataPoints = new Map<string, OpenCcuDataPoint>();
    for (const [parameter, type] of definitions) {
      dataPoints.set(parameter, {
        centralId: "ccu",
        interfaceId: "HmIP-RF",
        channelAddress: address,
        parameter,
        metadata: { TYPE: type, OPERATIONS: 7, FLAGS: 1 },
        readable: true,
        writable: true,
        eventable: true,
      });
    }
    channels.set(address, {
      address,
      type: "SWITCH",
      index,
      paramsets: ["VALUES"],
      dataPoints,
    });
  }
  return {
    address: "001",
    type: "HMIP-PSM",
    updatable: false,
    availability: "unknown",
    channels,
  };
}

function radiatorThermostat(type: string): OpenCcuDevice {
  const channels = new Map<string, OpenCcuChannel>();
  for (const [index, definitions] of [
    [0, [["LOW_BAT", "BOOL"]]],
    [
      1,
      [
        ["ACTUAL_TEMPERATURE", "FLOAT"],
        ["SET_POINT_TEMPERATURE", "FLOAT"],
        ["LEVEL", "FLOAT"],
      ],
    ],
  ] as const) {
    const address = `0039:${index}`;
    const dataPoints = new Map<string, OpenCcuDataPoint>();
    for (const [parameter, parameterType] of definitions) {
      dataPoints.set(parameter, {
        centralId: "ccu",
        interfaceId: "HmIP-RF",
        channelAddress: address,
        parameter,
        metadata: { TYPE: parameterType, OPERATIONS: 7, FLAGS: 1 },
        readable: true,
        writable: parameter === "SET_POINT_TEMPERATURE",
        eventable: true,
      });
    }
    channels.set(address, {
      address,
      type: index === 0 ? "MAINTENANCE" : "HEATING_CLIMATECONTROL_TRANSCEIVER",
      index,
      paramsets: ["VALUES"],
      dataPoints,
    });
  }
  return {
    address: "0039",
    type,
    updatable: false,
    availability: "unknown",
    channels,
  };
}

describe("ProfileRegistry", () => {
  it("resolves a dedicated HmIP power-meter profile", () => {
    expect(
      new ProfileRegistry()
        .resolve(powerSwitch())
        .map(({ capability }) => capability),
    ).toEqual([
      "onoff",
      "measure_power",
      "measure_voltage",
      "measure_current",
      "meter_power",
    ]);
  });

  it("rejects profiles claiming the same product type", () => {
    expect(
      () =>
        new ProfileRegistry([
          {
            id: "one",
            driverId: "one",
            deviceTypes: ["duplicate"],
            bindings: [],
          },
          {
            id: "two",
            driverId: "two",
            deviceTypes: ["duplicate"],
            bindings: [],
          },
        ]),
    ).toThrow(/multiple profiles/);
  });

  it.each(["HmIP-eTRV-B-2", "HmIP-eTRV-B-2 R4M", "HmIP-eTRV-2 I9F", "HmIP-eTRV-E-A"])(
    "routes %s to the dedicated radiator thermostat profile",
    (type) => {
      const registry = new ProfileRegistry();
      const profile = registry.find(type);
      expect(profile?.driverId).toBe("HmIP-eTRV-2");
      expect(registry.resolve(radiatorThermostat(type)).map(({ capability }) => capability)).toEqual([
        "alarm_battery",
        "measure_temperature",
        "target_temperature",
        "homematic_measure_valve",
      ]);
    },
  );
});
