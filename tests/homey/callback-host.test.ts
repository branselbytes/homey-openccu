import { describe, expect, it } from "vitest";

import { callbackHostFromLocalAddress } from "../../src/homey/callback-host";

describe("callbackHostFromLocalAddress", () => {
  it.each([
    ["192.168.1.10:80", "192.168.1.10"],
    ["http://192.168.1.10:80", "192.168.1.10"],
    ["[fd00::10]:80", "fd00::10"],
    ["fd00::10", "fd00::10"],
  ])("extracts a callback host from %s", (input, expected) => {
    expect(callbackHostFromLocalAddress(input)).toBe(expected);
  });

  it("rejects an empty address", () => {
    expect(() => callbackHostFromLocalAddress("  ")).toThrow(
      "Homey local address is empty",
    );
  });
});
