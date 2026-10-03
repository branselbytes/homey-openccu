import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { HMIP_PROFILES } from "../../src/profiles/hmip";
import { GENERIC_DRIVER_ID } from "../../src/mapping/device-resolver";

const SYSTEM_DRIVER_ID = "openccu-system";
const LEGACY_DRIVER_IDS = [
  "HMIP-PS",
  "HmIP-SWDO-2",
  "HmIP-SWDO-I",
  "HMIP-eTRV",
  "HmIP-eTRV-B",
  "HmIP-eTRV-B-2",
  "HmIP-eTRV-C",
  "HmIP-eTRV-E",
] as const;
const DEFAULT_ICON_DRIVER_IDS = ["openccu-generic"] as const;

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

  it("ships only profiled, generic, central-level, and retained legacy drivers", async () => {
    const expected = [
      ...new Set(HMIP_PROFILES.map((profile) => profile.driverId)),
      GENERIC_DRIVER_ID,
      SYSTEM_DRIVER_ID,
      ...LEGACY_DRIVER_IDS,
    ].sort();
    const actual = (await readdir(resolve("drivers"))).sort();
    expect(actual).toEqual(expected);
  });

  it("hides legacy family drivers from pairing while retaining their device adapters", async () => {
    for (const driverId of LEGACY_DRIVER_IDS) {
      const manifest = JSON.parse(
        await readFile(
          resolve("drivers", driverId, "driver.compose.json"),
          "utf8",
        ),
      ) as { deprecated?: boolean };
      expect(manifest.deprecated, driverId).toBe(true);
      await expect(
        access(resolve("drivers", driverId, "device.ts")),
      ).resolves.toBeUndefined();
      await expect(
        access(resolve("drivers", driverId, "driver.ts")),
      ).resolves.toBeUndefined();
    }
    for (const driverId of ["HMIP-PSM", "HMIP-SWDO", "HmIP-eTRV-2"]) {
      const manifest = JSON.parse(
        await readFile(
          resolve("drivers", driverId, "driver.compose.json"),
          "utf8",
        ),
      ) as { deprecated?: boolean };
      expect(manifest.deprecated, driverId).not.toBe(true);
    }
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

  it("reserves the neutral default icon for unknown generic devices", async () => {
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

  it("uses each driver's own product images with valid Homey sizes", async () => {
    for (const driverId of await readdir(resolve("drivers"))) {
      const manifest = JSON.parse(
        await readFile(
          resolve("drivers", driverId, "driver.compose.json"),
          "utf8",
        ),
      ) as { images: { small: string; large: string } };
      for (const [size, pixels] of [
        ["small", 75],
        ["large", 500],
      ] as const) {
        const path = `/drivers/${driverId}/assets/images/${size}.png`;
        expect(manifest.images[size], `${driverId} ${size}`).toBe(path);
        const png = await readFile(resolve(`.${path}`));
        expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
          pixels,
          pixels,
        ]);
      }
    }
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
