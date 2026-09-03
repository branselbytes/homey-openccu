import { access, readFile, readdir } from "node:fs/promises";
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

  it("routes selected devices to the add-devices pairing step", async () => {
    const driverIds = [
      ...new Set(HMIP_PROFILES.map((profile) => profile.driverId)),
      GENERIC_DRIVER_ID,
    ];
    for (const driverId of driverIds) {
      const manifest = JSON.parse(
        await readFile(
          resolve("drivers", driverId, "driver.compose.json"),
          "utf8",
        ),
      ) as { pair?: { id?: string; navigation?: { next?: string } }[] };
      expect(
        manifest.pair?.find(({ id }) => id === "list_devices")?.navigation,
      ).toEqual({ next: "add_devices" });
    }
  });
});
