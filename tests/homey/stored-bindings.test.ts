import { describe, expect, it } from "vitest";

import { parseStoredBindings } from "../../src/homey/stored-bindings";

describe("parseStoredBindings", () => {
  it("accepts complete serialized bindings and rejects writable bindings without targets", () => {
    expect(
      parseStoredBindings([
        {
          capability: "onoff",
          channelAddress: "301:3",
          parameter: "STATE",
          writeChannelAddress: "301:4",
          writeParameter: "STATE",
          readable: true,
          writable: true,
          transform: "boolean",
        },
      ]),
    ).toHaveLength(1);
    expect(() =>
      parseStoredBindings([
        {
          capability: "onoff",
          channelAddress: "301:3",
          parameter: "STATE",
          readable: true,
          writable: true,
          transform: "boolean",
        },
      ]),
    ).toThrow("no write target");
  });

  it("accepts the enum transform used by dedicated thermostat profiles", () => {
    expect(
      parseStoredBindings([
        {
          capability: "homematic_thermostat_mode",
          channelAddress: "301:1",
          parameter: "SET_POINT_MODE",
          writeChannelAddress: "301:1",
          writeParameter: "CONTROL_MODE",
          readable: true,
          writable: true,
          transform: "enum-number-to-string",
        },
      ]),
    ).toHaveLength(1);
  });

  it("preserves a supported non-direct write strategy", () => {
    expect(
      parseStoredBindings([
        {
          capability: "windowcoverings_state",
          channelAddress: "301:3",
          parameter: "ACTIVITY_STATE",
          writeChannelAddress: "301:4",
          writeParameter: "LEVEL",
          writeStrategy: "cover-state",
          readable: true,
          writable: true,
          transform: "activity-state-to-cover-state",
        },
      ]),
    ).toMatchObject([{ writeStrategy: "cover-state" }]);
  });
});
