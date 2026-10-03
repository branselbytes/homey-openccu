import { normalizeDeviceType } from "../profiles/registry";

// Homey resolves pairing icons relative to the driver's assets directory.
// Keep this explicit so device model strings can never become arbitrary paths.
const FAMILY_ICONS: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map([
  [
    "HMIP-PSM",
    new Map([
      ["HMIP-PS", "/models/ps.svg"],
      ["HMIP-PSM", "/models/psm.svg"],
      ["HMIP-PSM-2", "/models/psm-2.svg"],
      ["HMIP-PSM-2-A", "/models/psm-2.svg"],
    ]),
  ],
  [
    "HMIP-SWDO",
    new Map([
      ["HMIP-SWDO", "/models/swdo.svg"],
      ["HMIP-SWDO-2", "/models/swdo-2.svg"],
      ["HMIP-SWDO-I", "/models/swdo-i.svg"],
      ["HMIP-SWDO-A", "/models/swdo-a.svg"],
    ]),
  ],
  [
    "HmIP-eTRV-2",
    new Map([
      ["HMIP-ETRV", "/models/etrv.svg"],
      ["HMIP-ETRV-2", "/models/etrv-2.svg"],
      ["HMIP-ETRV-B", "/models/etrv-b.svg"],
      ["HMIP-ETRV-B-2", "/models/etrv-b-2.svg"],
      ["HMIP-ETRV-C", "/models/etrv-c.svg"],
      ["HMIP-ETRV-E", "/models/etrv-e.svg"],
      ["HMIP-ETRV-E-A", "/models/etrv-e.svg"],
    ]),
  ],
]);

export function resolvePairingDeviceIcon(
  driverId: string,
  deviceType: string,
): string | undefined {
  return FAMILY_ICONS.get(driverId)?.get(
    normalizeDeviceType(deviceType).toUpperCase(),
  );
}
