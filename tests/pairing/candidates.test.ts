import { describe, expect, it } from "vitest";

import { buildHmIpDeviceGraph } from "../../src/domain/model";
import { createPairingCandidates } from "../../src/pairing/candidates";

describe("createPairingCandidates", () => {
  it("routes known devices to their dedicated driver with stable identity", () => {
    const devices = buildHmIpDeviceGraph({
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptions: [
        { ADDRESS: "301", TYPE: "HmIP-PS", CHILDREN: ["301:3"] },
        {
          ADDRESS: "301:3",
          TYPE: "SWITCH",
          PARENT: "301",
          PARAMSETS: ["VALUES"],
        },
      ],
      paramsets: new Map([
        ["301:3", { STATE: { TYPE: "BOOL", OPERATIONS: 7, FLAGS: 1 } }],
      ]),
    });

    const [candidate] = createPairingCandidates(devices, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      names: new Map([["301", "Flurlicht"]]),
    });

    expect(candidate).toMatchObject({
      driverId: "HMIP-PS",
      name: "Flurlicht",
      data: { id: "ccu-1/HmIP-RF/301", address: "301" },
      capabilities: ["onoff"],
      store: {
        deviceType: "HmIP-PS",
        profileId: "hmip-switch",
        generic: false,
      },
    });
  });

  it("keeps unknown devices pairable through the generic fallback", () => {
    const devices = buildHmIpDeviceGraph({
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptions: [
        { ADDRESS: "999", TYPE: "HmIP-FUTURE", CHILDREN: ["999:1"] },
        {
          ADDRESS: "999:1",
          TYPE: "SENSOR",
          PARENT: "999",
          PARAMSETS: ["VALUES"],
        },
      ],
      paramsets: new Map([
        [
          "999:1",
          {
            ACTUAL_TEMPERATURE: {
              TYPE: "FLOAT",
              OPERATIONS: 5,
              FLAGS: 1,
              UNIT: "°C",
            },
          },
        ],
      ]),
    });

    const [candidate] = createPairingCandidates(devices, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
    });

    expect(candidate).toMatchObject({
      driverId: "openccu-generic",
      capabilities: ["measure_temperature"],
      store: { generic: true },
    });
  });

  it("adds assigned OpenCCU rooms and functions as device Flow tags", () => {
    const devices = buildHmIpDeviceGraph({
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptions: [
        { ADDRESS: "301", TYPE: "HmIP-PS", CHILDREN: ["301:3"] },
        {
          ADDRESS: "301:3",
          TYPE: "SWITCH",
          PARENT: "301",
          PARAMSETS: ["VALUES"],
        },
      ],
      paramsets: new Map([
        ["301:3", { STATE: { TYPE: "BOOL", OPERATIONS: 7, FLAGS: 1 } }],
      ]),
    });

    const [candidate] = createPairingCandidates(devices, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      metadata: {
        names: new Map(),
        rooms: new Map([["Workshop", ["301:3"]]]),
        functions: new Map([["Light", ["301:3"]]]),
        programs: [],
        systemVariables: [],
      },
    });

    expect(candidate?.capabilities).toEqual([
      "onoff",
      "openccu_room",
      "openccu_functions",
    ]);
  });

  it("creates one stable Homey candidate per logical multi-channel output", () => {
    const outputChannels = [6, 10, 14, 18];
    const devices = buildHmIpDeviceGraph({
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptions: [
        {
          ADDRESS: "401",
          TYPE: "HmIP-DRSI4",
          CHILDREN: outputChannels.map((channel) => `401:${channel}`),
        },
        ...outputChannels.map((channel) => ({
          ADDRESS: `401:${channel}`,
          TYPE: "SWITCH_VIRTUAL_RECEIVER",
          PARENT: "401",
          PARAMSETS: ["VALUES"],
        })),
      ],
      paramsets: new Map(
        outputChannels.map((channel) => [
          `401:${channel}`,
          { STATE: { TYPE: "BOOL" as const, OPERATIONS: 7, FLAGS: 1 } },
        ]),
      ),
    });

    const candidates = createPairingCandidates(devices, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      names: new Map([
        ["401", "DIN rail actor"],
        ["401:10", "Kitchen relay"],
      ]),
    });

    expect(candidates).toHaveLength(4);
    expect(candidates.map(({ data }) => data.id).sort()).toEqual([
      "ccu-1/HmIP-RF/401/output-1",
      "ccu-1/HmIP-RF/401/output-2",
      "ccu-1/HmIP-RF/401/output-3",
      "ccu-1/HmIP-RF/401/output-4",
    ]);
    const secondOutput = candidates.find(
      ({ data }) => data.logicalId === "output-2",
    );
    expect(secondOutput).toMatchObject({
      driverId: "HmIP-DRSI4",
      name: "Kitchen relay",
      data: { logicalId: "output-2" },
      capabilities: ["onoff"],
      store: { logicalId: "output-2" },
      mapping: {
        logicalId: "output-2",
        bindings: [
          {
            channelAddress: "401:10",
            writeChannelAddress: "401:10",
          },
        ],
      },
    });
    expect(
      candidates.some(({ name }) => name === "DIN rail actor Output 1"),
    ).toBe(true);
  });

  it("creates a dedicated thermostat candidate for a VirtualDevices heating group", () => {
    const address = "VCU-GROUP-1";
    const channelAddress = `${address}:1`;
    const devices = buildHmIpDeviceGraph({
      centralId: "ccu-1",
      interfaceId: "VirtualDevices",
      descriptions: [
        {
          ADDRESS: address,
          TYPE: "HmIP-HEATING",
          CHILDREN: [channelAddress],
        },
        {
          ADDRESS: channelAddress,
          TYPE: "HEATING_CLIMATECONTROL_TRANSCEIVER",
          PARENT: address,
          PARAMSETS: ["VALUES"],
        },
      ],
      paramsets: new Map([
        [
          channelAddress,
          {
            ACTUAL_TEMPERATURE: {
              TYPE: "FLOAT",
              OPERATIONS: 5,
              FLAGS: 1,
            },
            HUMIDITY: { TYPE: "INTEGER", OPERATIONS: 5, FLAGS: 1 },
            SET_POINT_TEMPERATURE: {
              TYPE: "FLOAT",
              OPERATIONS: 7,
              FLAGS: 1,
              MIN: 4.5,
              MAX: 30.5,
            },
            SET_POINT_MODE: {
              TYPE: "INTEGER",
              OPERATIONS: 5,
              FLAGS: 1,
            },
            CONTROL_MODE: {
              TYPE: "INTEGER",
              OPERATIONS: 2,
              FLAGS: 1,
            },
            BOOST_MODE: { TYPE: "BOOL", OPERATIONS: 6, FLAGS: 1 },
            ACTIVE_PROFILE: {
              TYPE: "INTEGER",
              OPERATIONS: 7,
              FLAGS: 1,
            },
          },
        ],
      ]),
    });

    const [candidate] = createPairingCandidates(devices, {
      centralId: "ccu-1",
      interfaceId: "VirtualDevices",
      names: new Map([[address, "Heating ground floor"]]),
    });

    expect(candidate).toMatchObject({
      driverId: "openccu-heating-group",
      name: "Heating ground floor",
      data: {
        id: `ccu-1/VirtualDevices/${address}`,
        interfaceId: "VirtualDevices",
        address,
      },
      capabilities: [
        "measure_temperature",
        "measure_humidity",
        "target_temperature",
        "homematic_thermostat_mode",
        "homematic_thermostat_boost",
        "homematic_thermostat_weekprofile",
      ],
      store: {
        deviceType: "HmIP-HEATING",
        profileId: "openccu-heating-group",
        generic: false,
      },
    });
    expect(
      candidate?.mapping.bindings.find(
        ({ capability }) => capability === "target_temperature",
      ),
    ).toMatchObject({
      channelAddress,
      writeChannelAddress: channelAddress,
      writeParameter: "SET_POINT_TEMPERATURE",
    });
  });
});
