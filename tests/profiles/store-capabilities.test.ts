import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildHmIpDeviceGraph } from "../../src/domain/model";
import { resolveDeviceMapping } from "../../src/mapping/device-resolver";
import { HMIP_PROFILES } from "../../src/profiles/hmip";
import type {
  DeviceDescription,
  ParamsetDescription,
} from "../../src/protocol/xmlrpc/types";

interface DriverManifest {
  readonly capabilities: readonly string[];
  readonly deprecated?: boolean;
}

function manifest(driverId: string): DriverManifest {
  return JSON.parse(
    readFileSync(`drivers/${driverId}/driver.compose.json`, "utf8"),
  ) as DriverManifest;
}

interface Recording {
  readonly description: DeviceDescription;
  readonly channels: readonly {
    readonly description: DeviceDescription;
    readonly parameters: ParamsetDescription;
  }[];
}

const recordings = JSON.parse(
  readFileSync("tests/fixtures/device-families.json", "utf8"),
) as Recording[];

describe("App Store capability baselines", () => {
  it("only declares system capabilities supported by the app's minimum Homey version", () => {
    // Use the same definitions and semver implementation as the installed
    // Homey validator, so new catalog entries cannot silently raise the minimum.
    const homeyRequire = createRequire(
      resolve("node_modules/homey/package.json"),
    );
    const library = homeyRequire("homey-lib") as {
      getCapabilities(): Record<string, { minCompatibility?: string }>;
    };
    const libraryRequire = createRequire(homeyRequire.resolve("homey-lib"));
    const semver = libraryRequire("semver") as {
      minVersion(range: string): { version: string } | null;
      gte(version: string, minimum: string): boolean;
    };
    const app = JSON.parse(readFileSync(".homeycompose/app.json", "utf8")) as {
      compatibility: string;
    };
    const minimum = semver.minVersion(app.compatibility);
    expect(minimum).not.toBeNull();
    if (!minimum) throw new Error("Invalid Homey compatibility range");
    const capabilities = library.getCapabilities();
    for (const driverId of readdirSync("drivers")) {
      for (const capability of manifest(driverId).capabilities) {
        const required =
          capabilities[capability.split(".")[0]]?.minCompatibility;
        if (required === undefined) continue;
        expect(
          semver.gte(minimum.version, required),
          driverId + ": " + capability + " requires Homey " + required,
        ).toBe(true);
      }
    }
  });

  it("gives named devices a profile-backed baseline without changing fallback or retired drivers", () => {
    for (const driverId of readdirSync("drivers")) {
      const declared = manifest(driverId);
      if (driverId === "openccu-generic" || declared.deprecated) {
        expect(declared.capabilities, driverId).toEqual([]);
        continue;
      }
      if (driverId === "openccu-system") continue;
      const profiles = HMIP_PROFILES.filter((p) => p.driverId === driverId);
      expect(profiles.length, driverId).toBeGreaterThan(0);
      // A family baseline must apply to each model/logical output, not the
      // union of optional features exposed by different models or modes.
      for (const profile of profiles) {
        for (const definition of profile.logicalDevices ?? [profile]) {
          const supported = definition.bindings
            .filter((binding) => binding.conditions === undefined)
            .map((binding) => binding.capability);
          for (const capability of declared.capabilities) {
            expect(supported, `${driverId}: ${capability}`).toContain(
              capability,
            );
          }
        }
      }
      if (declared.capabilities.length === 0) {
        for (const profile of profiles) {
          for (const definition of profile.logicalDevices ?? [profile]) {
            const hasButtonEvents =
              (definition.buttonChannels?.length ?? 0) > 0;
            const hasOnlyOptionalBindings = definition.bindings
              .filter((binding) => binding.capability !== "alarm_battery")
              .every(
                (binding) =>
                  binding.conditions !== undefined ||
                  binding.requiresWriteTarget === true,
              );
            expect(
              hasButtonEvents || hasOnlyOptionalBindings,
              driverId +
                " needs a supported capability or event in the catalog",
            ).toBe(true);
          }
        }
      }
    }
  });

  it.each(recordings)(
    "only advertises capabilities actually mapped from recorded $description.TYPE datapoints",
    (recording) => {
      const device = buildHmIpDeviceGraph({
        centralId: "fixture",
        interfaceId: "HmIP-RF",
        descriptions: [
          recording.description,
          ...recording.channels.map((channel) => channel.description),
        ],
        paramsets: new Map(
          recording.channels.map((channel) => [
            channel.description.ADDRESS,
            channel.parameters,
          ]),
        ),
      }).get(recording.description.ADDRESS);
      expect(device).toBeDefined();
      if (!device) throw new Error("Recorded device missing");
      const mapping = resolveDeviceMapping(device);
      const actionCapabilities = new Set([
        "onoff",
        "target_temperature",
        "homematic_thermostat_mode",
        "homematic_thermostat_boost",
        "homematic_thermostat_weekprofile",
      ]);
      for (const capability of manifest(mapping.driverId).capabilities) {
        const binding = mapping.bindings.find(
          (b) => b.capability === capability,
        );
        expect(binding, capability).toBeDefined();
        if (actionCapabilities.has(capability)) {
          expect(binding?.writable, capability).toBe(true);
        }
      }
    },
  );

  it("keeps variable input modes and optional controls out of unconditional Store promises", () => {
    expect(manifest("HmIPW-DRI16").capabilities).toEqual([]);
    expect(manifest("HmIP-RGBW").capabilities).toEqual(["onoff", "dim"]);
    expect(manifest("HMIP-PSM").capabilities).toEqual(["onoff"]);
    for (const driverId of ["HmIP-STH", "HmIP-STHD"]) {
      expect(manifest(driverId).capabilities).toEqual([
        "measure_temperature",
        "measure_humidity",
      ]);
    }
    for (const driverId of ["HmIP-SWSD", "HmIP-ASIR"]) {
      expect(manifest(driverId).capabilities).not.toContain("onoff");
    }
    for (const driverId of ["HmIP-SWO-B", "HmIP-SWO-PL"]) {
      expect(manifest(driverId).capabilities).not.toContain(
        "measure_wind_angle",
      );
      expect(manifest(driverId).capabilities).not.toContain("measure_rain");
    }
  });
});
