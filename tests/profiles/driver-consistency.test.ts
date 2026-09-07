import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { HMIP_PROFILES } from "../../src/profiles/hmip";
import { GENERIC_DRIVER_ID } from "../../src/mapping/device-resolver";

const SYSTEM_DRIVER_ID = "openccu-system";
const DEFAULT_ICON_DRIVER_IDS = [
  "HmIP-BBL",
  "HmIP-BS2",
  "HmIP-DLD",
  "HmIP-DRDI3",
  "HmIP-DRG-DALI",
  "HmIP-DRSI4",
  "HmIP-FS6",
  "HmIP-FSI",
  "HmIP-FSI16",
  "HmIP-FSI6",
  "HmIP-FSM16",
  "HmIP-MOD-TM",
  "HmIP-PCBS2",
  "HmIP-PDT",
  "HmIP-RGBW",
  "HmIP-SCTH230",
  "HmIP-SWDO-2",
  "HmIP-SWO-B",
  "HmIP-SWO-PL",
  "HmIP-USBSM",
  "HmIP-WGC",
  "HmIP-WHS2",
  "HmIP-WSM",
  "HmIP-eTRV-B-2",
  "HmIP-eTRV-E",
  "openccu-generic",
  "openccu-heating-group",
  "openccu-system",
] as const;

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

  it("exposes only profiled, generic, and central-level drivers", async () => {
    const expected = [
      ...new Set(HMIP_PROFILES.map((profile) => profile.driverId)),
      GENERIC_DRIVER_ID,
      SYSTEM_DRIVER_ID,
    ].sort();
    const actual = (await readdir(resolve("drivers"))).sort();
    expect(actual).toEqual(expected);
  });

  it("ships a local SVG icon for every active driver", async () => {
    const driverIds = await readdir(resolve("drivers"));
    for (const driverId of driverIds) {
      const icon = await readFile(
        resolve("drivers", driverId, "assets", "icon.svg"),
        "utf8",
      );
      expect(icon, driverId).toMatch(/<svg\b/u);
      expect(icon, driverId).not.toMatch(/<script\b/iu);
    }
  });

  it("uses the shared default exactly for drivers without imported artwork", async () => {
    const defaultIcon = await readFile(
      resolve("assets", "default-device.svg"),
      "utf8",
    );
    const driverIds = await readdir(resolve("drivers"));
    const defaultDrivers = (
      await Promise.all(
        driverIds.map(async (driverId) => ({
          driverId,
          icon: await readFile(
            resolve("drivers", driverId, "assets", "icon.svg"),
            "utf8",
          ),
        })),
      )
    )
      .filter(({ icon }) => icon === defaultIcon)
      .map(({ driverId }) => driverId)
      .sort();

    expect(defaultDrivers).toEqual([...DEFAULT_ICON_DRIVER_IDS].sort());
  });

  it("routes selected devices to the add-devices pairing step", async () => {
    const driverIds = [
      ...new Set(HMIP_PROFILES.map((profile) => profile.driverId)),
      GENERIC_DRIVER_ID,
      SYSTEM_DRIVER_ID,
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

  it("separates OpenCCU groups from physical thermostats in device selection", async () => {
    const manifest = JSON.parse(
      await readFile(
        resolve("drivers", "openccu-heating-group", "driver.compose.json"),
        "utf8",
      ),
    ) as { class?: string; name?: { en?: string; de?: string } };

    expect(manifest).toMatchObject({
      class: "other",
      name: { en: "OpenCCU groups", de: "OpenCCU Gruppen" },
    });
  });
});
