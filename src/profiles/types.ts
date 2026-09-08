import type { OpenCcuChannel, OpenCcuDevice } from "../domain/model";
import type {
  ButtonEventBinding,
  CapabilityBinding,
  ValueTransform,
  WriteStrategy,
} from "../mapping/types";
import type { RpcScalar } from "../protocol/xmlrpc/types";

export interface ProfileConfigurationParameter {
  readonly channel: number;
  readonly parameter: string;
}

export interface ProfileCondition {
  readonly channel: number;
  readonly parameter: string;
  readonly oneOf: readonly RpcScalar[];
}

export interface ProfileBinding {
  readonly capability: string;
  readonly channel: number;
  readonly parameter: string;
  readonly fallbackParameters?: readonly string[];
  readonly setChannel?: number;
  readonly setParameter?: string;
  readonly requiresWriteTarget?: boolean;
  readonly requiredWriteParameters?: readonly string[];
  readonly transform?: ValueTransform;
  readonly writeStrategy?: WriteStrategy;
  readonly conditions?: readonly ProfileCondition[];
}

export interface ProfileMappingDefinition {
  readonly bindings: readonly ProfileBinding[];
  readonly buttonChannels?: readonly number[];
  readonly buttonConditions?: readonly ProfileCondition[];
  readonly conditions?: readonly ProfileCondition[];
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
  readonly configurationParameters?: readonly ProfileConfigurationParameter[];
}

export function resolveProfileButtonEvents(
  device: OpenCcuDevice,
  profile: ProfileMappingDefinition,
): readonly ButtonEventBinding[] {
  if (
    !matchesConditions(device, profile.conditions) ||
    !matchesConditions(device, profile.buttonConditions)
  )
    return [];
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
  if (!matchesConditions(device, profile.conditions)) return [];
  const result: CapabilityBinding[] = [];
  for (const definition of profile.bindings) {
    if (!matchesConditions(device, definition.conditions)) continue;
    const channel = [...device.channels.values()].find(
      (candidate) => candidate.index === definition.channel,
    );
    if (!channel) continue;
    const parameter = findParameter(channel, definition);
    if (parameter === undefined) continue;
    const dataPoint = channel.dataPoints.get(parameter);
    if (!dataPoint) continue;
    const writeTarget = findWriteTarget(device, definition, parameter);
    if (definition.requiresWriteTarget === true && writeTarget === undefined)
      continue;
    if (!hasRequiredWriteParameters(device, definition)) continue;
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
      ...(definition.writeStrategy === undefined
        ? {}
        : { writeStrategy: definition.writeStrategy }),
    });
  }
  return result;
}

function matchesConditions(
  device: OpenCcuDevice,
  conditions: readonly ProfileCondition[] | undefined,
): boolean {
  return (conditions ?? []).every((condition) => {
    const value = device.configuration?.get(
      `${device.address}:${condition.channel}`,
    )?.[condition.parameter];
    return condition.oneOf.some((expected) => Object.is(expected, value));
  });
}

function hasRequiredWriteParameters(
  device: OpenCcuDevice,
  definition: ProfileBinding,
): boolean {
  const required = definition.requiredWriteParameters;
  if (required === undefined) return true;
  const channelIndex = definition.setChannel ?? definition.channel;
  const channel = [...device.channels.values()].find(
    (candidate) => candidate.index === channelIndex,
  );
  return required.every(
    (parameter) => channel?.dataPoints.get(parameter)?.writable === true,
  );
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
