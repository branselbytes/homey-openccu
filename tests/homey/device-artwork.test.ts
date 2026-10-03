import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolvePairingDeviceIcon } from "../../src/homey/device-artwork";

const MODELS = [
  ["HMIP-PSM", "HMIP-PS", "ps"],
  ["HMIP-PSM", "HmIP-PSM", "psm"],
  ["HMIP-PSM", "HmIP-PSM-2", "psm-2"],
  ["HMIP-PSM", "HmIP-PSM-2-A", "psm-2"],
  ["HMIP-SWDO", "HMIP-SWDO", "swdo"],
  ["HMIP-SWDO", "HmIP-SWDO-2", "swdo-2"],
  ["HMIP-SWDO", "HmIP-SWDO-I", "swdo-i"],
  ["HMIP-SWDO", "HmIP-SWDO-A", "swdo-a"],
  ["HmIP-eTRV-2", "HMIP-eTRV", "etrv"],
  ["HmIP-eTRV-2", "HmIP-eTRV-2", "etrv-2"],
  ["HmIP-eTRV-2", "HmIP-eTRV-B", "etrv-b"],
  ["HmIP-eTRV-2", "HmIP-eTRV-B-2", "etrv-b-2"],
  ["HmIP-eTRV-2", "HmIP-eTRV-C", "etrv-c"],
  ["HmIP-eTRV-2", "HmIP-eTRV-E", "etrv-e"],
  ["HmIP-eTRV-2", "HmIP-eTRV-E-A", "etrv-e"],
] as const;

describe("model-specific family icons", () => {
  it.each(MODELS)(
    "%s pairs %s with its packaged model icon",
    async (driverId, deviceType, name) => {
      const icon = resolvePairingDeviceIcon(driverId, deviceType);
      expect(icon).toBe(`/models/${name}.svg`);
      await expect(
        access(join("drivers", driverId, "assets", `models/${name}.svg`)),
      ).resolves.toBeUndefined();
    },
  );

  it.each([
    ["HMIP-PSM", "  HmIP-PSM-2 QHJ  ", "/models/psm-2.svg"],
    ["HMIP-PSM", "HMIP-PSM-2-A", "/models/psm-2.svg"],
    ["HMIP-SWDO", "HMIP-SWDO-A", "/models/swdo-a.svg"],
    ["HMIP-SWDO", " HmIP-SWDO-2  REV1 ", "/models/swdo-2.svg"],
    ["HmIP-eTRV-2", "HmIP-eTRV-2 I9F", "/models/etrv-2.svg"],
    ["HmIP-eTRV-2", "HmIP-eTRV-B-2 R4M", "/models/etrv-b-2.svg"],
  ])(
    "normalizes CCU model labels for %s / %s",
    (driverId, deviceType, icon) => {
      expect(resolvePairingDeviceIcon(driverId, deviceType)).toBe(icon);
    },
  );

  it.each([
    ["HMIP-PS", "HmIP-PS"],
    ["openccu-generic", "HmIP-SWDO-A"],
    ["HmIP-PDT", "HmIP-PDT"],
    ["HmIPW-STH", "HmIPW-STH"],
    ["HMIP-PSM", "HmIP-SWDO-A"],
    ["HMIP-SWDO", "HmIP-SWDO-FUTURE"],
    ["HMIP-PSM", "../../private.svg"],
    ["HMIP-SWDO", "HmIP-SWDO-A/../../private.svg"],
    ["__proto__", "constructor"],
    ["HMIP-SWDO", ""],
  ])(
    "keeps default artwork for unsupported driver/model %s / %s",
    (driverId, deviceType) => {
      expect(resolvePairingDeviceIcon(driverId, deviceType)).toBeUndefined();
    },
  );
});
