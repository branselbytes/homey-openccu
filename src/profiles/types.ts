import type { OpenCcuDevice } from "../domain/model";
import type { CapabilityBinding, ValueTransform } from "../mapping/types";

export interface ProfileBinding {
  readonly capability: string;
  readonly channel: number;
  readonly parameter: string;
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
    const channel = [...device.channels.values()].find((candidate) => candidate.index === definition.channel);
    const dataPoint = channel?.dataPoints.get(definition.parameter);
    if (!channel || !dataPoint) continue;
    result.push({
      capability: definition.capability,
      channelAddress: channel.address,
      parameter: definition.parameter,
      readable: dataPoint.readable,
      writable:
        definition.setParameter !== undefined
          ? hasWritableTarget(device, definition.setChannel ?? definition.channel, definition.setParameter)
          : dataPoint.writable,
      transform: definition.transform ?? "identity",
    });
  }
  return result;
}

function hasWritableTarget(device: OpenCcuDevice, channelIndex: number, parameter: string): boolean {
  const channel = [...device.channels.values()].find((candidate) => candidate.index === channelIndex);
  return channel?.dataPoints.get(parameter)?.writable ?? false;
}
