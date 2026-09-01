import type { OpenCcuDevice } from "../domain/model";
import { MappingDecisionLog } from "./decision";
import { mapGenericDevice } from "./generic-mapper";
import type { CapabilityBinding } from "./types";
import { ProfileRegistry } from "../profiles/registry";

export const GENERIC_DRIVER_ID = "openccu-generic";

export interface ResolvedDeviceMapping {
  readonly driverId: string;
  readonly profileId?: string;
  readonly generic: boolean;
  readonly bindings: readonly CapabilityBinding[];
  readonly decisions: ReturnType<MappingDecisionLog["list"]>;
}

export function resolveDeviceMapping(
  device: OpenCcuDevice,
  profiles = new ProfileRegistry(),
): ResolvedDeviceMapping {
  const decisions = new MappingDecisionLog();
  const profile = profiles.find(device.type);
  if (profile) {
    return {
      driverId: profile.driverId,
      profileId: profile.id,
      generic: false,
      bindings: profiles.resolve(device, decisions),
      decisions: decisions.list(),
    };
  }
  return {
    driverId: GENERIC_DRIVER_ID,
    generic: true,
    bindings: mapGenericDevice(device, decisions),
    decisions: decisions.list(),
  };
}
