import type { MappingDecisionLog } from "../mapping/decision";
import type { OpenCcuDevice } from "../domain/model";
import { HMIP_PROFILES } from "./hmip";
import {
  resolveProfileBindings,
  type DeviceProfile,
  type ProfileMappingDefinition,
  type ProfileConfigurationParameter,
} from "./types";

export class ProfileRegistry {
  readonly #profiles: readonly DeviceProfile[];

  constructor(profiles: readonly DeviceProfile[] = HMIP_PROFILES) {
    this.#profiles = profiles;
    const claimedTypes = new Set<string>();
    for (const profile of profiles) {
      assertLogicalDeviceIdsAreUnique(profile);
      for (const type of profile.deviceTypes) {
        if (claimedTypes.has(type))
          throw new Error(
            `Device type ${type} is claimed by multiple profiles`,
          );
        claimedTypes.add(type);
      }
    }
  }

  find(deviceType: string): DeviceProfile | undefined {
    const normalized = normalizeDeviceType(deviceType);
    return this.#profiles.find((profile) =>
      profile.deviceTypes.some(
        (type) => normalizeDeviceType(type) === normalized,
      ),
    );
  }

  configurationParameters(
    deviceType: string,
  ): readonly ProfileConfigurationParameter[] {
    return this.find(deviceType)?.configurationParameters ?? [];
  }

  resolve(
    device: OpenCcuDevice,
    decisions?: MappingDecisionLog,
    logicalId?: string,
  ): readonly ReturnType<typeof resolveProfileBindings>[number][] {
    const profile = this.find(device.type);
    if (!profile) return [];
    const definition = selectMappingDefinition(profile, logicalId);
    const bindings = resolveProfileBindings(device, definition);
    for (const binding of bindings) {
      decisions?.add({
        channelAddress: binding.channelAddress,
        parameter: binding.parameter,
        kind: "profile",
        capability: binding.capability,
        profile: profile.id,
        reason: `Matched dedicated profile for ${device.type}`,
      });
    }
    return bindings;
  }
}

function assertLogicalDeviceIdsAreUnique(profile: DeviceProfile): void {
  const claimedIds = new Set<string>();
  for (const logical of profile.logicalDevices ?? []) {
    if (claimedIds.has(logical.id)) {
      throw new Error(
        `Logical device ${logical.id} is declared multiple times by profile ${profile.id}`,
      );
    }
    claimedIds.add(logical.id);
  }
}

function selectMappingDefinition(
  profile: DeviceProfile,
  logicalId: string | undefined,
): ProfileMappingDefinition {
  if (profile.logicalDevices === undefined) return profile;
  const logical = profile.logicalDevices.find(({ id }) => id === logicalId);
  if (logical === undefined) {
    throw new Error(
      `Profile ${profile.id} requires a valid logical device identity`,
    );
  }
  return logical;
}

export function normalizeDeviceType(deviceType: string): string {
  return deviceType.trim().split(/\s+/, 1)[0] ?? deviceType;
}
