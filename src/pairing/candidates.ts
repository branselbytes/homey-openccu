import type { OpenCcuDevice } from "../domain/model";
import { resolveDeviceMapping, type ResolvedDeviceMapping } from "../mapping/device-resolver";
import type { CapabilityBinding } from "../mapping/types";
import type { ProfileRegistry } from "../profiles/registry";

export interface PairingCandidateData {
  readonly id: string;
  readonly centralId: string;
  readonly interfaceId: string;
  readonly address: string;
}

export interface PairingCandidateStore {
  readonly deviceType: string;
  readonly profileId?: string;
  readonly generic: boolean;
  readonly bindings: readonly CapabilityBinding[];
}

export interface PairingCandidate {
  readonly driverId: string;
  readonly name: string;
  readonly data: PairingCandidateData;
  readonly capabilities: readonly string[];
  readonly store: PairingCandidateStore;
  readonly mapping: ResolvedDeviceMapping;
}

export interface PairingCandidateOptions {
  readonly centralId: string;
  readonly interfaceId: string;
  readonly names?: ReadonlyMap<string, string>;
  readonly profiles?: ProfileRegistry;
}

export function createPairingCandidates(
  devices: ReadonlyMap<string, OpenCcuDevice>,
  options: PairingCandidateOptions,
): readonly PairingCandidate[] {
  return [...devices.values()]
    .map((device) => createCandidate(device, options))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function createCandidate(device: OpenCcuDevice, options: PairingCandidateOptions): PairingCandidate {
  const mapping = resolveDeviceMapping(device, options.profiles);
  const capabilities = [...new Set(mapping.bindings.map((binding) => binding.capability))];
  return {
    driverId: mapping.driverId,
    name: options.names?.get(device.address) ?? `${device.type} (${device.address})`,
    data: {
      id: `${options.centralId}/${options.interfaceId}/${device.address}`,
      centralId: options.centralId,
      interfaceId: options.interfaceId,
      address: device.address,
    },
    capabilities,
    store: {
      deviceType: device.type,
      profileId: mapping.profileId,
      generic: mapping.generic,
      bindings: mapping.bindings,
    },
    mapping,
  };
}
