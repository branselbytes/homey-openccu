import { describe, expect, it } from "vitest";

import { buildHmIpDeviceGraph } from "../../src/domain/model";
import type {
  DeviceDescription,
  ParamsetDescription,
} from "../../src/protocol/xmlrpc/types";

describe("buildHmIpDeviceGraph", () => {
  it("normalizes device, channel and datapoint descriptions", () => {
    const descriptions: DeviceDescription[] = [
      { ADDRESS: "001", TYPE: "HmIP-PS", CHILDREN: ["001:1"], FIRMWARE: "1.0" },
      {
        ADDRESS: "001:1",
        TYPE: "SWITCH",
        PARENT: "001",
        PARAMSETS: ["VALUES"],
      },
    ];
    const values: ParamsetDescription = {
      STATE: { TYPE: "BOOL", OPERATIONS: 7, FLAGS: 1 },
    };
    const devices = buildHmIpDeviceGraph({
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptions,
      paramsets: new Map([["001:1", values]]),
    });
    const state = devices
      .get("001")
      ?.channels.get("001:1")
      ?.dataPoints.get("STATE");
    expect(state).toMatchObject({
      readable: true,
      writable: true,
      eventable: true,
    });
  });
});
