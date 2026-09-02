import { access, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { HMIP_PROFILES } from "../../src/profiles/hmip";
import { GENERIC_DRIVER_ID } from "../../src/mapping/device-resolver";

describe("dedicated profile drivers", () => {
  it("reference existing Homey driver directories", async () => {
    await expect(
      Promise.all(
        HMIP_PROFILES.map((profile) =>
          access(resolve("drivers", profile.driverId, "driver.compose.json")),
        ),
      ),
    ).resolves.toBeDefined();
  });

  it("ships the generic fallback driver", async () => {
    await expect(
      access(resolve("drivers", GENERIC_DRIVER_ID, "driver.compose.json")),
    ).resolves.toBeUndefined();
  });

  it("exposes only profiled drivers and the generic fallback", async () => {
    const expected = [
      ...new Set(HMIP_PROFILES.map((profile) => profile.driverId)),
      GENERIC_DRIVER_ID,
    ].sort();
    const actual = (await readdir(resolve("drivers"))).sort();
    expect(actual).toEqual(expected);
  });
});
