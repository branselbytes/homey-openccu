import type { OpenCcuDevice, OpenCcuMetadata } from "../domain/model";
import { resolveOrganizationCapabilities } from "../homey/device-organization-capabilities";
import {
  resolveDeviceMappings,
  type ResolvedDeviceMapping,
} from "../mapping/device-resolver";
import type { CapabilityBinding } from "../mapping/types";
import type { ProfileRegistry } from "../profiles/registry";

export interface PairingCandidateData {
  readonly id: string;
  readonly centralId: string;
  readonly interfaceId: string;
  readonly address: string;
  readonly logicalId?: string;
}

export interface PairingCandidateStore {
  readonly deviceType: string;
  readonly profileId?: string;
  readonly generic: boolean;
  readonly logicalId?: string;
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
  readonly metadata?: OpenCcuMetadata;
  readonly profiles?: ProfileRegistry;
}

export function createPairingCandidates(
  devices: ReadonlyMap<string, OpenCcuDevice>,
  options: PairingCandidateOptions,
): readonly PairingCandidate[] {
  return [...devices.values()]
    .flatMap((device) => createCandidates(device, options))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function createCandidates(
  device: OpenCcuDevice,
  options: PairingCandidateOptions,
): readonly PairingCandidate[] {
  return resolveDeviceMappings(device, options.profiles).map((mapping) =>
    createCandidate(device, mapping, options),
  );
}

function createCandidate(
  device: OpenCcuDevice,
  mapping: ResolvedDeviceMapping,
  options: PairingCandidateOptions,
): PairingCandidate {
  const capabilities = [
    ...new Set(mapping.bindings.map((binding) => binding.capability)),
  ];
  if (options.metadata !== undefined) {
    capabilities.push(
      ...Object.keys(
        resolveOrganizationCapabilities(
          options.metadata,
          device.address,
          mapping,
        ),
      ),
    );
  }
  const logicalIdentity =
    mapping.logicalId === undefined ? "" : `/${mapping.logicalId}`;
  const baseName =
    options.names?.get(device.address) ?? `${device.type} (${device.address})`;
  const channelName =
    mapping.nameChannel === undefined
      ? undefined
      : options.names?.get(`${device.address}:${mapping.nameChannel}`);
  return {
    driverId: mapping.driverId,
    name:
      channelName ??
      (mapping.nameSuffix === undefined
        ? baseName
        : `${baseName} ${mapping.nameSuffix}`),
    data: {
      id: `${options.centralId}/${options.interfaceId}/${device.address}${logicalIdentity}`,
      centralId: options.centralId,
      interfaceId: options.interfaceId,
      address: device.address,
      ...(mapping.logicalId === undefined
        ? {}
        : { logicalId: mapping.logicalId }),
    },
    capabilities,
    store: {
      deviceType: device.type,
      profileId: mapping.profileId,
      generic: mapping.generic,
      ...(mapping.logicalId === undefined
        ? {}
        : { logicalId: mapping.logicalId }),
      bindings: mapping.bindings,
    },
    mapping,
  };
}
