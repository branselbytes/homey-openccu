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
});
