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
});
