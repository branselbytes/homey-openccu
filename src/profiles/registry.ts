import type { MappingDecisionLog } from "../mapping/decision";
import type { OpenCcuDevice } from "../domain/model";
import { HMIP_PROFILES } from "./hmip";
import { resolveProfileBindings, type DeviceProfile } from "./types";

export class ProfileRegistry {
  readonly #profiles: readonly DeviceProfile[];

  constructor(profiles: readonly DeviceProfile[] = HMIP_PROFILES) {
    this.#profiles = profiles;
    const claimedTypes = new Set<string>();
    for (const profile of profiles) {
      for (const type of profile.deviceTypes) {
        if (claimedTypes.has(type)) throw new Error(`Device type ${type} is claimed by multiple profiles`);
        claimedTypes.add(type);
      }
    }
  }

  find(deviceType: string): DeviceProfile | undefined {
    return this.#profiles.find((profile) => profile.deviceTypes.includes(deviceType));
  }

  resolve(device: OpenCcuDevice, decisions?: MappingDecisionLog): readonly ReturnType<typeof resolveProfileBindings>[number][] {
    const profile = this.find(device.type);
    if (!profile) return [];
    const bindings = resolveProfileBindings(device, profile);
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
