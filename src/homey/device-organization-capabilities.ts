import type { OpenCcuMetadata } from "../domain/model";
import type { ResolvedDeviceMapping } from "../mapping/device-resolver";
import type { RpcValue } from "../protocol/xmlrpc/types";

export const OPENCCU_ROOM_CAPABILITY = "openccu_room";
export const OPENCCU_FUNCTIONS_CAPABILITY = "openccu_functions";

export function resolveOrganizationCapabilities(
  metadata: OpenCcuMetadata,
  deviceAddress: string,
  mapping: ResolvedDeviceMapping,
): Readonly<Record<string, RpcValue>> {
  const channelAddresses = relevantChannelAddresses(deviceAddress, mapping);
  const rooms = matchingGroupNames(metadata.rooms, channelAddresses);
  const functions = matchingGroupNames(metadata.functions, channelAddresses);
  return {
    ...(rooms.length === 0
      ? {}
      : { [OPENCCU_ROOM_CAPABILITY]: rooms.join(", ") }),
    ...(functions.length === 0
      ? {}
      : { [OPENCCU_FUNCTIONS_CAPABILITY]: functions.join(", ") }),
  };
}

function relevantChannelAddresses(
  deviceAddress: string,
  mapping: ResolvedDeviceMapping,
): ReadonlySet<string> {
  const addresses = new Set<string>();
  for (const binding of mapping.bindings) {
    addresses.add(binding.channelAddress);
    if (binding.writeChannelAddress !== undefined)
      addresses.add(binding.writeChannelAddress);
  }
  for (const buttonEvent of mapping.buttonEvents)
    addresses.add(buttonEvent.channelAddress);
  if (mapping.nameChannel !== undefined)
    addresses.add(`${deviceAddress}:${mapping.nameChannel}`);
  return addresses;
}

function matchingGroupNames(
  groups: ReadonlyMap<string, readonly string[]>,
  channelAddresses: ReadonlySet<string>,
): readonly string[] {
  return [...groups]
    .filter(([, members]) =>
      members.some((channelAddress) => channelAddresses.has(channelAddress)),
    )
    .map(([name]) => name)
    .sort((left, right) => left.localeCompare(right));
}
