import { describe, expect, it } from "vitest";

import type {
  OpenCcuChannel,
  OpenCcuDataPoint,
  OpenCcuDevice,
} from "../../src/domain/model";
import {
  resolveDeviceMapping,
  resolveDeviceMappings,
} from "../../src/mapping/device-resolver";
import { ProfileRegistry } from "../../src/profiles/registry";

function powerSwitch(type = "HMIP-PSM"): OpenCcuDevice {
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
    type,
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

function sensor(
  type: string,
  definitions: readonly (readonly [
    number,
    string,
    OpenCcuDataPoint["metadata"]["TYPE"],
  ])[],
): OpenCcuDevice {
  const channels = new Map<string, OpenCcuChannel>();
  for (const [index, parameter, parameterType] of definitions) {
    const address = `sensor:${index}`;
    const dataPoints = new Map(channels.get(address)?.dataPoints ?? []);
    const channel = channels.get(address) ?? {
      address,
      type: index === 0 ? "MAINTENANCE" : "SENSOR",
      index,
      paramsets: ["VALUES"],
      dataPoints,
    };
    dataPoints.set(parameter, {
      centralId: "ccu",
      interfaceId: "HmIP-RF",
      channelAddress: address,
      parameter,
      metadata: { TYPE: parameterType, OPERATIONS: 5, FLAGS: 1 },
      readable: true,
      writable: false,
      eventable: true,
    });
    channels.set(address, { ...channel, dataPoints });
  }
  return {
    address: "sensor",
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

  it("rejects duplicate logical device identities within one profile", () => {
    expect(
      () =>
        new ProfileRegistry([
          {
            id: "multi",
            driverId: "multi",
            deviceTypes: ["multi"],
            bindings: [],
            logicalDevices: [
              { id: "output-1", nameSuffix: "Output 1", bindings: [] },
              { id: "output-1", nameSuffix: "Output 2", bindings: [] },
            ],
          },
        ]),
    ).toThrow(/declared multiple times/);
  });

  it.each([
    ["HmIP-eTRV-B-2", "HmIP-eTRV-B-2"],
    ["HmIP-eTRV-B-2 R4M", "HmIP-eTRV-B-2"],
    ["HmIP-eTRV-2 I9F", "HmIP-eTRV-2"],
    ["HmIP-eTRV-E-A", "HmIP-eTRV-E"],
  ])("routes %s to radiator product driver %s", (type, driverId) => {
    const registry = new ProfileRegistry();
    const profile = registry.find(type);
    expect(profile?.driverId).toBe(driverId);
    expect(
      registry
        .resolve(radiatorThermostat(type))
        .map(({ capability }) => capability),
    ).toEqual([
      "alarm_battery",
      "measure_temperature",
      "target_temperature",
      "homematic_measure_valve",
    ]);
  });

  it.each([
    [
      "HmIP-SWDO-2",
      "HmIP-SWDO-2",
      [
        [1, "STATE", "BOOL"],
        [0, "LOW_BAT", "BOOL"],
      ],
      ["alarm_contact", "alarm_battery"],
    ],
    [
      "HmIP-SWO-PR",
      "HmIP-SWO-PR",
      [
        [1, "ACTUAL_TEMPERATURE", "FLOAT"],
        [1, "HUMIDITY", "FLOAT"],
        [1, "ILLUMINATION", "FLOAT"],
        [0, "LOW_BAT", "BOOL"],
      ],
      [
        "measure_temperature",
        "measure_humidity",
        "measure_luminance",
        "alarm_battery",
      ],
    ],
    [
      "HmIP-SLO",
      "HmIP-SLO",
      [
        [1, "CURRENT_ILLUMINATION", "FLOAT"],
        [0, "LOW_BAT", "BOOL"],
      ],
      ["measure_luminance", "alarm_battery"],
    ],
    [
      "HmIP-STE2-PCB",
      "HmIP-STE2-PCB",
      [
        [1, "ACTUAL_TEMPERATURE", "FLOAT"],
        [0, "LOW_BAT", "BOOL"],
      ],
      ["measure_temperature", "alarm_battery"],
    ],
  ] as const)(
    "routes %s to its dedicated passive-sensor driver",
    (type, driverId, definitions, capabilities) => {
      const registry = new ProfileRegistry();
      expect(registry.find(type)?.driverId).toBe(driverId);
      expect(
        registry
          .resolve(sensor(type, definitions))
          .map(({ capability }) => capability),
      ).toEqual(capabilities);
    },
  );

  it.each([
    ["HmIP-PCBS", "HmIP-PCBS"],
    ["HmIP-PCBS-BAT", "HmIP-PCBS-BAT"],
    ["HmIP-DRSI1", "HmIP-DRSI1"],
    ["HmIP-DRSI4", "HmIP-DRSI4"],
    ["HmIP-MOD-OC8", "HmIP-MOD-OC8"],
    ["HmIP-FSI", "HmIP-FSI"],
    ["HmIP-FSI6", "HmIP-FSI6"],
    ["HmIP-FSI16", "HmIP-FSI16"],
    ["HmIP-FS6", "HmIP-FS6"],
    ["HmIP-USBSM", "HmIP-USBSM"],
    ["HmIP-WGC", "HmIP-WGC"],
    ["HmIP-PCBS2", "HmIP-PCBS2"],
    ["HmIP-BS2", "HmIP-BS2"],
    ["HmIP-WHS2", "HmIP-WHS2"],
    ["HmIP-BDT", "HmIP-BDT"],
    ["HmIP-FDT", "HmIP-FDT"],
    ["HmIP-PDT", "HmIP-PDT"],
    ["HmIP-DRDI3", "HmIP-DRDI3"],
    ["HmIP-SWDO-I", "HmIP-SWDO-I"],
    ["HmIP-SWDM", "HmIP-SWDM"],
    ["HMIP-WTH", "HMIP-WTH"],
    ["HmIP-WTH", "HMIP-WTH"],
    ["HmIP-BWTH", "HmIP-BWTH"],
    ["HmIP-STHD", "HmIP-STHD"],
    ["HmIP-STHO", "HmIP-STHO"],
    ["HmIP-ASIR", "HmIP-ASIR"],
    ["HmIP-WSM", "HmIP-WSM"],
    ["HmIP-BSM", "HmIP-BSM"],
    ["HmIP-FSM", "HmIP-FSM"],
    ["HmIP-FSM16", "HmIP-FSM16"],
  ])("routes %s to product driver %s", (type, driverId) => {
    expect(new ProfileRegistry().find(type)?.driverId).toBe(driverId);
  });

  it.each([
    ["HmIP-FSI", 3],
    ["HmIP-FSI6", 3],
    ["HmIP-FSI16", 3],
    ["HmIP-FS6", 2],
    ["HmIP-USBSM", 3],
    ["HmIP-WGC", 3],
  ])("maps %s switching to channel %i", (type, channel) => {
    expect(
      resolveDeviceMapping(sensor(type, [[channel, "STATE", "BOOL"]]))
        .bindings[0],
    ).toMatchObject({
      capability: "onoff",
      channelAddress: `sensor:${channel}`,
    });
  });

  it("maps HmIP-WSM valve control to channel 4", () => {
    expect(
      resolveDeviceMapping(
        sensor("HmIP-WSM", [
          [4, "STATE", "BOOL"],
          [0, "LOW_BAT", "BOOL"],
        ]),
      ).bindings,
    ).toMatchObject([
      { capability: "onoff", channelAddress: "sensor:4" },
      { capability: "alarm_battery", channelAddress: "sensor:0" },
    ]);
  });

  it("maps HmIP-WSM flow and cumulative liters to Homey water units", () => {
    expect(
      resolveDeviceMapping(
        sensor("HmIP-WSM", [
          [2, "WATER_FLOW", "FLOAT"],
          [2, "WATER_VOLUME", "FLOAT"],
          [4, "STATE", "BOOL"],
        ]),
      ).bindings,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "measure_water",
          parameter: "WATER_FLOW",
        }),
        expect.objectContaining({
          capability: "meter_water",
          parameter: "WATER_VOLUME",
          transform: "liter-to-cubic-meter",
        }),
      ]),
    );
  });

  it("maps HmIP-BSM switching, metering, and both button channels", () => {
    const mapping = resolveDeviceMapping(
      sensor("HmIP-BSM", [
        [1, "PRESS_SHORT", "ACTION"],
        [2, "PRESS_LONG", "ACTION"],
        [4, "STATE", "BOOL"],
        [7, "POWER", "FLOAT"],
        [7, "VOLTAGE", "FLOAT"],
        [7, "CURRENT", "FLOAT"],
        [7, "ENERGY_COUNTER", "FLOAT"],
      ]),
    );
    expect(mapping.bindings.map(({ capability }) => capability)).toEqual([
      "onoff",
      "measure_power",
      "measure_voltage",
      "measure_current",
      "meter_power",
    ]);
    expect(mapping.buttonEvents).toMatchObject([
      { button: 1, pressType: "short" },
      { button: 2, pressType: "long" },
    ]);
  });

  it.each(["HmIP-FSM", "HmIP-FSM16"])(
    "maps %s switching to channel 2 and metering to channel 5",
    (type) => {
      const mapping = resolveDeviceMapping(
        sensor(type, [
          [2, "STATE", "BOOL"],
          [5, "POWER", "FLOAT"],
          [5, "VOLTAGE", "FLOAT"],
          [5, "CURRENT", "FLOAT"],
          [5, "ENERGY_COUNTER", "FLOAT"],
        ]),
      );
      expect(mapping.bindings).toMatchObject([
        { capability: "onoff", channelAddress: "sensor:2" },
        { capability: "measure_power", channelAddress: "sensor:5" },
        { capability: "measure_voltage", channelAddress: "sensor:5" },
        { capability: "measure_current", channelAddress: "sensor:5" },
        { capability: "meter_power", channelAddress: "sensor:5" },
      ]);
    },
  );

  it.each([
    ["HmIP-PCBS2", [4, 8]],
    ["HmIP-BS2", [4, 8]],
    ["HmIP-WHS2", [2, 6]],
  ] as const)("maps %s to one logical device per output", (type, channels) => {
    const mappings = resolveDeviceMappings(
      sensor(
        type,
        channels.map((channel) => [channel, "STATE", "BOOL"] as const),
      ),
    );
    expect(mappings.map(({ logicalId }) => logicalId)).toEqual([
      "output-1",
      "output-2",
    ]);
    expect(mappings.map(({ bindings }) => bindings[0]?.channelAddress)).toEqual(
      channels.map((channel) => `sensor:${channel}`),
    );
  });

  it.each([
    ["HmIP-BDT", 4],
    ["HmIP-FDT", 2],
    ["HmIP-PDT", 3],
  ])("maps %s LEVEL on channel %i to on/off and dim", (type, channel) => {
    expect(
      resolveDeviceMapping(sensor(type, [[channel, "LEVEL", "FLOAT"]]))
        .bindings,
    ).toMatchObject([
      {
        capability: "onoff",
        channelAddress: `sensor:${channel}`,
        transform: "positive-number-to-boolean",
      },
      {
        capability: "dim",
        channelAddress: `sensor:${channel}`,
        transform: "identity",
      },
    ]);
  });

  it("maps HmIP-DRDI3 to three logical dimmer outputs", () => {
    const mappings = resolveDeviceMappings(
      sensor("HmIP-DRDI3", [
        [5, "LEVEL", "FLOAT"],
        [9, "LEVEL", "FLOAT"],
        [13, "LEVEL", "FLOAT"],
      ]),
    );
    expect(mappings.map(({ logicalId }) => logicalId)).toEqual([
      "output-1",
      "output-2",
      "output-3",
    ]);
    expect(
      mappings.map(({ bindings }) =>
        bindings.map(({ capability }) => capability),
      ),
    ).toEqual([
      ["onoff", "dim"],
      ["onoff", "dim"],
      ["onoff", "dim"],
    ]);
  });

  it.each([
    ["HmIP-BRC2", "HmIP-BRC2"],
    ["HMIP-WRC2", "HMIP-WRC2"],
    ["HmIP-WRC2", "HMIP-WRC2"],
    ["HmIP-WRC6", "HmIP-WRC6"],
    ["HmIP-RC8", "HmIP-RC8"],
  ])("routes %s to remote driver %s", (type, driverId) => {
    expect(new ProfileRegistry().find(type)?.driverId).toBe(driverId);
  });

  it("maps only button press datapoints that discovery actually reports", () => {
    const mapping = resolveDeviceMapping(
      sensor("HmIP-BRC2", [
        [1, "PRESS_SHORT", "ACTION"],
        [1, "PRESS_LONG", "ACTION"],
        [2, "PRESS_SHORT", "ACTION"],
      ]),
    );

    expect(mapping.buttonEvents).toEqual([
      {
        channelAddress: "sensor:1",
        parameter: "PRESS_SHORT",
        button: 1,
        pressType: "short",
      },
      {
        channelAddress: "sensor:1",
        parameter: "PRESS_LONG",
        button: 1,
        pressType: "long",
      },
      {
        channelAddress: "sensor:2",
        parameter: "PRESS_SHORT",
        button: 2,
        pressType: "short",
      },
    ]);
  });

  it("maps the rotary handle as a three-state value instead of a boolean contact", () => {
    expect(
      new ProfileRegistry().resolve(
        sensor("HmIP-SRH", [
          [1, "STATE", "INTEGER"],
          [0, "LOW_BAT", "BOOL"],
        ]),
      ),
    ).toMatchObject([
      {
        capability: "homematic_rhs_state",
        transform: "enum-number-to-string",
      },
      { capability: "alarm_battery", transform: "boolean" },
    ]);
  });

  it("keeps the outdoor temperature sensor read-only", () => {
    expect(
      new ProfileRegistry()
        .resolve(
          sensor("HmIP-STHO", [
            [1, "ACTUAL_TEMPERATURE", "FLOAT"],
            [1, "HUMIDITY", "FLOAT"],
            [0, "LOW_BAT", "BOOL"],
          ]),
        )
        .map(({ capability }) => capability),
    ).toEqual(["measure_temperature", "measure_humidity", "alarm_battery"]);
  });

  it("maps HmIP-SCTH230 air quality, climate, and physical relay", () => {
    const registry = new ProfileRegistry();
    expect(registry.find("HmIP-SCTH230")?.driverId).toBe("HmIP-SCTH230");
    expect(
      resolveDeviceMapping(
        sensor("HmIP-SCTH230", [
          [1, "CONCENTRATION", "FLOAT"],
          [4, "ACTUAL_TEMPERATURE", "FLOAT"],
          [4, "HUMIDITY", "FLOAT"],
          [8, "STATE", "BOOL"],
          [12, "LEVEL", "FLOAT"],
        ]),
      ).bindings,
    ).toMatchObject([
      { capability: "measure_co2", channelAddress: "sensor:1" },
      { capability: "measure_temperature", channelAddress: "sensor:4" },
      { capability: "measure_humidity", channelAddress: "sensor:4" },
      { capability: "onoff", channelAddress: "sensor:8" },
    ]);
  });

  it.each([
    ["HmIP-BROLL", "HmIP-BROLL"],
    ["HmIP-FROLL", "HmIP-FROLL"],
    ["HmIP-FBL", "HmIP-FBL"],
    ["HmIP-BBL", "HmIP-BBL"],
    ["HmIP-DLD", "HmIP-DLD"],
    ["HmIP-MOD-HO", "HmIP-MOD-HO"],
    ["HmIP-MOD-TM", "HmIP-MOD-TM"],
  ])("routes %s to cover product driver %s", (type, driverId) => {
    expect(new ProfileRegistry().find(type)?.driverId).toBe(driverId);
  });

  it.each([
    ["HmIP-SMI", "HmIP-SMI", "MOTION"],
    ["HmIP-SMI55", "HmIP-SMI55", "MOTION"],
    ["HmIP-SMO-A", "HmIP-SMO-A", "MOTION"],
    ["HmIP-SPI", "HmIP-SPI", "PRESENCE_DETECTION_STATE"],
    ["HmIP-SAM", "HmIP-SAM", "MOTION"],
  ])("maps %s through sensor driver %s", (type, driverId, alarmParameter) => {
    const registry = new ProfileRegistry();
    expect(registry.find(type)?.driverId).toBe(driverId);
    expect(
      registry.resolve(
        sensor(type, [
          [1, alarmParameter, "BOOL"],
          [1, "ILLUMINATION", "FLOAT"],
          [0, "LOW_BAT", "BOOL"],
        ]),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capability: "alarm_motion" }),
        expect.objectContaining({ capability: "alarm_battery" }),
      ]),
    );
  });

  it("uses legacy fallback parameters only when the preferred water datapoint is absent", () => {
    const registry = new ProfileRegistry();
    const legacy = registry.resolve(
      sensor("HmIP-SWD", [
        [1, "ALARMSTATE", "BOOL"],
        [0, "LOWBAT", "BOOL"],
      ]),
    );
    expect(legacy).toMatchObject([
      { capability: "alarm_water", parameter: "ALARMSTATE" },
      { capability: "alarm_battery", parameter: "LOWBAT" },
    ]);
    const current = registry.resolve(
      sensor("HmIP-SWD", [
        [1, "WATERLEVEL_DETECTED", "BOOL"],
        [1, "ALARMSTATE", "BOOL"],
      ]),
    );
    expect(current[0]).toMatchObject({ parameter: "WATERLEVEL_DETECTED" });
  });

  it("maps smoke detector status to the standard Homey smoke alarm", () => {
    expect(
      new ProfileRegistry().resolve(
        sensor("HmIP-SWSD", [
          [1, "SMOKE_DETECTOR_ALARM_STATUS", "ENUM"],
          [0, "LOWBAT", "BOOL"],
        ]),
      ),
    ).toMatchObject([
      {
        capability: "alarm_smoke",
        transform: "smoke-status-to-boolean",
      },
      { capability: "alarm_battery" },
    ]);
  });

  it("omits smoke-detector siren control without its command datapoint", () => {
    const withoutCommand = new ProfileRegistry().resolve(
      sensor("HmIP-SWSD", [
        [1, "SMOKE_DETECTOR_ALARM_STATUS", "ENUM"],
        [0, "LOWBAT", "BOOL"],
      ]),
    );
    expect(withoutCommand.map(({ capability }) => capability)).toEqual([
      "alarm_smoke",
      "alarm_battery",
    ]);
  });
});
