import { ProtocolError } from "./errors";
import type { DeviceDescription, XmlRpcClient } from "./xmlrpc/types";

export interface HmIpRfBackend {
  readonly interfaceType: "HmIP-RF";
  readonly devices: readonly DeviceDescription[];
}

export async function detectHmIpRfBackend(
  client: XmlRpcClient,
  signal?: AbortSignal,
): Promise<HmIpRfBackend> {
  try {
    const devices = await client.listDevices(signal);
    return { interfaceType: "HmIP-RF", devices };
  } catch (error) {
    throw new ProtocolError("not-connected", "HmIP-RF XML-RPC endpoint is unavailable", error);
  }
}
