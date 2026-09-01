import type {
  DeviceDescription,
  ParameterDescription,
  ParamsetDescription,
  RpcValue,
} from "../protocol/xmlrpc/types";

export const HMIP_RF_INTERFACE = "HmIP-RF" as const;
export const PARAMETER_OPERATION = {
  read: 1,
  write: 2,
  event: 4,
} as const;

export type Availability = "available" | "unknown" | "unreachable";

export interface DataPointIdentity {
  readonly centralId: string;
  readonly interfaceId: string;
  readonly channelAddress: string;
  readonly parameter: string;
}

export interface OpenCcuDataPoint extends DataPointIdentity {
  readonly metadata: ParameterDescription;
  readonly readable: boolean;
  readonly writable: boolean;
  readonly eventable: boolean;
  readonly value?: RpcValue;
  readonly updatedAt?: string;
}

export interface OpenCcuChannel {
  readonly address: string;
  readonly type: string;
  readonly index?: number;
  readonly paramsets: readonly string[];
  readonly dataPoints: ReadonlyMap<string, OpenCcuDataPoint>;
}

export interface OpenCcuDevice {
  readonly address: string;
  readonly type: string;
  readonly firmware?: string;
  readonly availableFirmware?: string;
  readonly updatable: boolean;
  readonly availability: Availability;
  readonly channels: ReadonlyMap<string, OpenCcuChannel>;
}

export interface OpenCcuInterface {
  readonly id: string;
  readonly type: typeof HMIP_RF_INTERFACE;
  readonly devices: ReadonlyMap<string, OpenCcuDevice>;
}

export interface OpenCcuMetadata {
  readonly names: ReadonlyMap<string, string>;
  readonly rooms: ReadonlyMap<string, readonly string[]>;
  readonly functions: ReadonlyMap<string, readonly string[]>;
  readonly programs: readonly OpenCcuProgram[];
  readonly systemVariables: readonly OpenCcuSystemVariable[];
}

export interface OpenCcuProgram {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
}

export interface OpenCcuSystemVariable {
  readonly id: string;
  readonly name: string;
  readonly value: RpcValue;
}

export interface OpenCcuCentral {
  readonly id: string;
  readonly host: string;
  readonly version?: string;
  readonly interfaces: ReadonlyMap<string, OpenCcuInterface>;
  readonly metadata: OpenCcuMetadata;
}

export interface DeviceGraphInput {
  readonly centralId: string;
  readonly interfaceId: string;
  readonly descriptions: readonly DeviceDescription[];
  readonly paramsets: ReadonlyMap<string, ParamsetDescription>;
}

export function buildHmIpDeviceGraph(input: DeviceGraphInput): ReadonlyMap<string, OpenCcuDevice> {
  const descriptions = new Map(input.descriptions.map((description) => [description.ADDRESS, description]));
  const devices = new Map<string, OpenCcuDevice>();

  for (const description of input.descriptions) {
    if (description.PARENT) continue;
    const channels = new Map<string, OpenCcuChannel>();
    for (const channelAddress of description.CHILDREN ?? []) {
      const channel = descriptions.get(channelAddress);
      if (!channel) continue;
      const dataPoints = createDataPoints(input, channelAddress, input.paramsets.get(channelAddress));
      channels.set(channelAddress, {
        address: channelAddress,
        type: channel.TYPE,
        index: parseChannelIndex(channelAddress),
        paramsets: channel.PARAMSETS ?? [],
        dataPoints,
      });
    }
    devices.set(description.ADDRESS, {
      address: description.ADDRESS,
      type: description.TYPE,
      firmware: description.FIRMWARE,
      availableFirmware: description.AVAILABLE_FIRMWARE,
      updatable: description.UPDATABLE ?? false,
      availability: "unknown",
      channels,
    });
  }
  return devices;
}

function createDataPoints(
  input: DeviceGraphInput,
  channelAddress: string,
  paramset: ParamsetDescription | undefined,
): ReadonlyMap<string, OpenCcuDataPoint> {
  const result = new Map<string, OpenCcuDataPoint>();
  for (const [parameter, metadata] of Object.entries(paramset ?? {})) {
    result.set(parameter, {
      centralId: input.centralId,
      interfaceId: input.interfaceId,
      channelAddress,
      parameter,
      metadata,
      readable: hasOperation(metadata, PARAMETER_OPERATION.read),
      writable: hasOperation(metadata, PARAMETER_OPERATION.write),
      eventable: hasOperation(metadata, PARAMETER_OPERATION.event),
    });
  }
  return result;
}

function hasOperation(metadata: ParameterDescription, operation: number): boolean {
  return (metadata.OPERATIONS & operation) === operation;
}

function parseChannelIndex(address: string): number | undefined {
  const separator = address.lastIndexOf(":");
  if (separator === -1) return undefined;
  const parsed = Number(address.slice(separator + 1));
  return Number.isInteger(parsed) ? parsed : undefined;
}
