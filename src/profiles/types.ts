import type { OpenCcuChannel, OpenCcuDevice } from "../domain/model";
import type { CapabilityBinding, ValueTransform } from "../mapping/types";

export interface ProfileBinding {
  readonly capability: string;
  readonly channel: number;
  readonly parameter: string;
  readonly fallbackParameters?: readonly string[];
  readonly setChannel?: number;
  readonly setParameter?: string;
  readonly transform?: ValueTransform;
}

export interface DeviceProfile {
  readonly id: string;
  readonly driverId: string;
  readonly deviceTypes: readonly string[];
  readonly bindings: readonly ProfileBinding[];
}

export function resolveProfileBindings(
  device: OpenCcuDevice,
  profile: DeviceProfile,
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
