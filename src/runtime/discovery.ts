import { buildHmIpDeviceGraph, type OpenCcuDevice } from "../domain/model";
import type {
  DeviceDescription,
  ParamsetDescription,
  XmlRpcClient,
} from "../protocol/xmlrpc/types";

export interface DiscoveryOptions {
  readonly centralId: string;
  readonly interfaceId: string;
  readonly concurrency?: number;
}

export interface ParamsetDiscoveryIssue {
  readonly channelAddress: string;
  readonly message: string;
}

export interface HmIpDiscoveryResult {
  readonly devices: ReadonlyMap<string, OpenCcuDevice>;
  readonly descriptions: readonly DeviceDescription[];
  readonly paramsets: ReadonlyMap<string, ParamsetDescription>;
  readonly issues: readonly ParamsetDiscoveryIssue[];
}

/** Discovers one HmIP-RF interface without depending on Homey APIs. */
export async function discoverHmIpDevices(
  client: XmlRpcClient,
  options: DiscoveryOptions,
  signal?: AbortSignal,
): Promise<HmIpDiscoveryResult> {
  const concurrency = options.concurrency ?? 4;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("Discovery concurrency must be a positive integer");
  }

  const descriptions = await client.listDevices(signal);
  const channels = descriptions.filter(
    (description) =>
      description.PARENT !== undefined && description.PARAMSETS?.includes("VALUES") === true,
  );
  const paramsets = new Map<string, ParamsetDescription>();
  const issues: ParamsetDiscoveryIssue[] = [];

  await mapConcurrent(channels, concurrency, async (channel) => {
    try {
      const description = await client.getParamsetDescription(channel.ADDRESS, "VALUES", signal);
      paramsets.set(channel.ADDRESS, description);
    } catch (error) {
      if (signal?.aborted) throw error;
      issues.push({
        channelAddress: channel.ADDRESS,
        message: safeErrorMessage(error),
      });
    }
  });

  return {
    devices: buildHmIpDeviceGraph({
      centralId: options.centralId,
      interfaceId: options.interfaceId,
      descriptions,
      paramsets,
    }),
    descriptions,
    paramsets,
    issues,
  };
}

async function mapConcurrent<T>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < values.length) {
      const value = values[cursor];
      cursor += 1;
      if (value !== undefined) await operation(value);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown paramset discovery error";
}
