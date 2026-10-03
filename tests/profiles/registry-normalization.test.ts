import { describe, expect, it } from "vitest";

import { ProfileRegistry } from "../../src/profiles/registry";
import type { DeviceProfile } from "../../src/profiles/types";

function profile(id: string, deviceTypes: readonly string[]): DeviceProfile {
  return { id, driverId: id, deviceTypes, bindings: [] };
}

describe("normalized profile ownership", () => {
  it.each([
    ["HmIP-SWDO", " HmIP-SWDO "],
    ["HmIP-SWDO", "HmIP-SWDO R4M"],
    ["HmIP-SWDO R4M", "HmIP-SWDO I9F"],
  ])("rejects conflicting claims for %j and %j", (first, second) => {
    expect(
      () =>
        new ProfileRegistry([
          profile("one", [first]),
          profile("two", [second]),
        ]),
    ).toThrow("Device type HmIP-SWDO is claimed by multiple profiles");
  });

  it.each(["HmIP-SWDO", "HmIP-SWDO R4M"])(
    "rejects distinct profiles with the same ID claiming %s",
    (second) => {
      expect(
        () =>
          new ProfileRegistry([
            profile("same-id", ["HmIP-SWDO"]),
            profile("same-id", [second]),
          ]),
      ).toThrow(/multiple profiles/);
    },
  );

  it("allows equivalent aliases owned by one profile and finds all revisions", () => {
    const owner = profile("contact", [
      "HmIP-SWDO",
      " HmIP-SWDO ",
      "HmIP-SWDO R4M",
    ]);
    const registry = new ProfileRegistry([owner]);

    for (const type of [
      "HmIP-SWDO",
      " HmIP-SWDO ",
      "HmIP-SWDO R4M",
      " HmIP-SWDO\tI9F ",
    ]) {
      expect(registry.find(type)).toBe(owner);
    }
  });
});
