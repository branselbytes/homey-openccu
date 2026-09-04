import { describe, expect, it } from "vitest";

import { buildHmIpDeviceGraph } from "../../src/domain/model";
import { resolveDeviceMapping } from "../../src/mapping/device-resolver";
import { HMIP_COVER_PROFILE } from "../../src/profiles/hmip";
import { resolveProfileBindings } from "../../src/profiles/types";
import type { ParamsetDescription } from "../../src/protocol/xmlrpc/types";

describe("profile write targets", () => {
  it("preserves a cover's separate command channel", () => {
    const device = buildHmIpDeviceGraph({
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptions: [
        { ADDRESS: "301", TYPE: "HmIP-BROLL", CHILDREN: ["301:3", "301:4"] },
        {
          ADDRESS: "301:3",
          TYPE: "SHUTTER",
          PARENT: "301",
          PARAMSETS: ["VALUES"],
        },
        {
          ADDRESS: "301:4",
          TYPE: "SHUTTER_TRANSCEIVER",
          PARENT: "301",
          PARAMSETS: ["VALUES"],
        },
      ],
      paramsets: new Map<string, ParamsetDescription>([
        [
          "301:3",
          {
            LEVEL: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
            ACTIVITY_STATE: {
              TYPE: "ENUM",
              OPERATIONS: 5,
              FLAGS: 1,
              VALUE_LIST: ["UNKNOWN", "UP", "DOWN", "STABLE"],
            },
          },
        ],
        ["301:4", { LEVEL: { TYPE: "FLOAT", OPERATIONS: 2, FLAGS: 1 } }],
      ]),
    }).get("301");

    expect(device).toBeDefined();
    expect(resolveProfileBindings(device!, HMIP_COVER_PROFILE)).toMatchObject([
      {
        capability: "windowcoverings_set",
        channelAddress: "301:3",
        writeChannelAddress: "301:4",
        writeParameter: "LEVEL",
        writable: true,
      },
      {
        capability: "windowcoverings_state",
        channelAddress: "301:3",
        writeChannelAddress: "301:4",
        writeParameter: "LEVEL",
        writeStrategy: "cover-state",
        transform: "activity-state-to-cover-state",
        writable: true,
      },
    ]);
  });

  it("maps a blind's position and tilt to the separate command channel", () => {
    const device = buildHmIpDeviceGraph({
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptions: [
        { ADDRESS: "401", TYPE: "HmIP-FBL", CHILDREN: ["401:3", "401:4"] },
        {
          ADDRESS: "401:3",
          TYPE: "BLIND",
          PARENT: "401",
          PARAMSETS: ["VALUES"],
        },
        {
          ADDRESS: "401:4",
          TYPE: "BLIND_TRANSCEIVER",
          PARENT: "401",
          PARAMSETS: ["VALUES"],
        },
      ],
      paramsets: new Map<string, ParamsetDescription>([
        [
          "401:3",
          {
            LEVEL: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
            LEVEL_2: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
            ACTIVITY_STATE: { TYPE: "ENUM", OPERATIONS: 5, FLAGS: 1 },
          },
        ],
        [
          "401:4",
          {
            LEVEL: { TYPE: "FLOAT", OPERATIONS: 2, FLAGS: 1 },
            LEVEL_2: { TYPE: "FLOAT", OPERATIONS: 2, FLAGS: 1 },
          },
        ],
      ]),
    }).get("401");

    expect(device).toBeDefined();
    expect(resolveDeviceMapping(device!).bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "windowcoverings_tilt_set",
          channelAddress: "401:3",
          parameter: "LEVEL_2",
          writeChannelAddress: "401:4",
          writeParameter: "LEVEL_2",
        }),
      ]),
    );
  });
});
