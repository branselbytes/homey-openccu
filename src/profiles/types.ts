import type { OpenCcuChannel, OpenCcuDevice } from "../domain/model";
import type {
  ButtonEventBinding,
  CapabilityBinding,
  ValueTransform,
} from "../mapping/types";

export interface ProfileBinding {
  readonly capability: string;
  readonly channel: number;
  readonly parameter: string;
  readonly fallbackParameters?: readonly string[];
  readonly setChannel?: number;
  readonly setParameter?: string;
  readonly transform?: ValueTransform;
}

export interface ProfileMappingDefinition {
  readonly bindings: readonly ProfileBinding[];
  readonly buttonChannels?: readonly number[];
}

export interface LogicalDeviceProfile extends ProfileMappingDefinition {
  readonly id: string;
  readonly nameSuffix: string;
  readonly nameChannel?: number;
}

export interface DeviceProfile extends ProfileMappingDefinition {
  readonly id: string;
  readonly driverId: string;
  readonly deviceTypes: readonly string[];
  readonly logicalDevices?: readonly LogicalDeviceProfile[];
}

export function resolveProfileButtonEvents(
  device: OpenCcuDevice,
  profile: ProfileMappingDefinition,
): readonly ButtonEventBinding[] {
  const result: ButtonEventBinding[] = [];
  for (const channelIndex of profile.buttonChannels ?? []) {
    const channel = [...device.channels.values()].find(
      (candidate) => candidate.index === channelIndex,
    );
    if (!channel) continue;
    for (const [parameter, pressType] of [
      ["PRESS_SHORT", "short"],
      ["PRESS_LONG", "long"],
    ] as const) {
      if (!channel.dataPoints.has(parameter)) continue;
      result.push({
        channelAddress: channel.address,
        parameter,
        button: channelIndex,
        pressType,
      });
    }
  }
  return result;
}

export function resolveProfileBindings(
  device: OpenCcuDevice,
  profile: ProfileMappingDefinition,
): readonly CapabilityBinding[] {
  const result: CapabilityBinding[] = [];
  for (const definition of profile.bindings) {
    const channel = [...device.channels.values()].find(
      (candidate) => candidate.index === definition.channel,
    );
    if (!channel) continue;
    const parameter = findParameter(channel, definition);
    if (parameter === undefined) continue;
    const dataPoint = channel.dataPoints.get(parameter);
    if (!dataPoint) continue;
    const writeTarget = findWriteTarget(device, definition, parameter);
    result.push({
      capability: definition.capability,
      channelAddress: channel.address,
      parameter,
      readable: dataPoint.readable,
      writable: writeTarget !== undefined,
      ...(writeTarget === undefined
        ? {}
        : {
            writeChannelAddress: writeTarget.channelAddress,
            writeParameter: writeTarget.parameter,
          }),
      transform: definition.transform ?? "identity",
    });
  }
  return result;
}

function findWriteTarget(
  device: OpenCcuDevice,
  definition: ProfileBinding,
  resolvedParameter: string,
): { readonly channelAddress: string; readonly parameter: string } | undefined {
  const parameter = definition.setParameter ?? resolvedParameter;
  const channelIndex = definition.setChannel ?? definition.channel;
  const channel = [...device.channels.values()].find(
    (candidate) => candidate.index === channelIndex,
  );
  return channel?.dataPoints.get(parameter)?.writable === true
    ? { channelAddress: channel.address, parameter }
    : undefined;
}

function findParameter(
  channel: OpenCcuChannel | undefined,
  definition: ProfileBinding,
): string | undefined {
  if (!channel) return undefined;
  return [definition.parameter, ...(definition.fallbackParameters ?? [])].find(
    (parameter) => channel.dataPoints.has(parameter),
  );
}
