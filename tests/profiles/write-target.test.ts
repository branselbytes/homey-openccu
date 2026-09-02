import { describe, expect, it } from "vitest";

import { buildHmIpDeviceGraph } from "../../src/domain/model";
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
    expect(
      resolveProfileBindings(device!, HMIP_COVER_PROFILE)[0],
    ).toMatchObject({
      capability: "windowcoverings_set",
      channelAddress: "301:3",
      writeChannelAddress: "301:4",
      writeParameter: "LEVEL",
      writable: true,
    });
  });
});
