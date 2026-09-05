import { buildHmIpDeviceGraph, type OpenCcuDevice } from "../domain/model";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../protocol/xmlrpc/types";
import { createDescriptionCacheKey } from "../cache/versioned-cache";

export interface DescriptionCache {
  get(key: string): Promise<ParamsetDescription | undefined>;
  set(key: string, value: ParamsetDescription): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface DiscoveryOptions {
  readonly centralId: string;
  readonly interfaceId: string;
  readonly concurrency?: number;
  readonly descriptionCache?: DescriptionCache;
  readonly configurationParameters?: (
    deviceType: string,
  ) => readonly { readonly channel: number; readonly parameter: string }[];
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
  const configuration = new Map<
    string,
    Readonly<Record<string, RpcValue>>
  >();

  await mapConcurrent(channels, concurrency, async (channel) => {
    const cacheKey = createDescriptionCacheKey(
      options.centralId,
      options.interfaceId,
      channel.ADDRESS,
      "VALUES",
    );
    try {
      const cached = await options.descriptionCache?.get(cacheKey);
      const description =
        cached ??
        (await client.getParamsetDescription(channel.ADDRESS, "VALUES", signal));
      paramsets.set(channel.ADDRESS, description);
      if (cached === undefined) await options.descriptionCache?.set(cacheKey, description);
    } catch (error) {
      if (signal?.aborted) throw error;
      issues.push({
        channelAddress: channel.ADDRESS,
        message: safeErrorMessage(error),
      });
    }
  });

  const configurationRequests = descriptions
    .filter((description) => description.PARENT === undefined)
    .flatMap((device) =>
      groupConfigurationParameters(
        device.ADDRESS,
        options.configurationParameters?.(device.TYPE) ?? [],
      ),
    );
  await mapConcurrent(configurationRequests, concurrency, async (request) => {
    try {
      const [metadata, values] = await Promise.all([
        client.getParamsetDescription(request.channelAddress, "MASTER", signal),
        client.getParamset(request.channelAddress, "MASTER", signal),
      ]);
      configuration.set(
        request.channelAddress,
        Object.fromEntries(
          request.parameters.flatMap((parameter) => {
            if (!(parameter in values)) return [];
            return [
              [
                parameter,
                normalizeConfigurationValue(values[parameter], metadata[parameter]),
              ],
            ];
          }),
        ),
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      issues.push({
        channelAddress: request.channelAddress,
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
      configuration,
    }),
    descriptions,
    paramsets,
    issues,
  };
}

function groupConfigurationParameters(
  deviceAddress: string,
  parameters: readonly { readonly channel: number; readonly parameter: string }[],
): readonly { readonly channelAddress: string; readonly parameters: readonly string[] }[] {
  const grouped = new Map<number, string[]>();
  for (const entry of parameters) {
    const values = grouped.get(entry.channel) ?? [];
    if (!values.includes(entry.parameter)) values.push(entry.parameter);
    grouped.set(entry.channel, values);
  }
  return [...grouped].map(([channel, values]) => ({
    channelAddress: `${deviceAddress}:${channel}`,
    parameters: values,
  }));
}

function normalizeConfigurationValue(
  value: RpcValue,
  metadata: ParamsetDescription[string] | undefined,
): RpcValue {
  if (
    metadata?.TYPE === "ENUM" &&
    typeof value === "number" &&
    Number.isInteger(value)
  ) {
    return metadata.VALUE_LIST?.[value] ?? value;
  }
  return value;
}

export function descriptionCacheKey(
  centralId: string,
  interfaceId: string,
  channelAddress: string,
): string {
  return createDescriptionCacheKey(centralId, interfaceId, channelAddress, "VALUES");
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
