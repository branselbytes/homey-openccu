import { createSocket, type RemoteInfo, type Socket } from "node:dgram";
import { isIP } from "node:net";

export const OPENCCU_DISCOVERY_PORT = 43_439;
export const OPENCCU_DISCOVERY_CLIENT_PORT = 48_724;
export const OPENCCU_DISCOVERY_MESSAGE = Buffer.from([
  0x02, 0x8f, 0x91, 0xc0, 0x01, 0x65, 0x51, 0x33, 0x2d, 0x2a, 0x00, 0x2a, 0x00,
  0x49,
]);

const DISCOVERY_HEADER_LENGTH = 5;
const OPENCCU_DISCOVERY_HEADER = OPENCCU_DISCOVERY_MESSAGE.subarray(
  0,
  DISCOVERY_HEADER_LENGTH,
);
const DEFAULT_DISCOVERY_TIMEOUT_MS = 2_000;
const MAX_DISCOVERY_FIELD_LENGTH = 128;

export interface DiscoveredOpenCcu {
  readonly address: string;
  readonly type: string;
  readonly serial: string;
}

export interface OpenCcuDiscoveryOptions {
  readonly timeoutMs?: number;
  readonly broadcastAddress?: string;
  readonly unicastAddresses?: readonly string[];
  readonly createSocket?: () => Socket;
}

export async function discoverOpenCcus(
  options: OpenCcuDiscoveryOptions = {},
): Promise<readonly DiscoveredOpenCcu[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10_000) {
    throw new RangeError(
      "OpenCCU discovery timeout must be between 100 and 10000 ms",
    );
  }
  const broadcastAddress = options.broadcastAddress ?? "255.255.255.255";
  if (isIP(broadcastAddress) !== 4) {
    throw new TypeError("OpenCCU discovery requires an IPv4 broadcast address");
  }
  const unicastAddresses = [...new Set(options.unicastAddresses ?? [])];
  if (unicastAddresses.some((address) => isIP(address) !== 4)) {
    throw new TypeError(
      "OpenCCU discovery unicast targets must be IPv4 addresses",
    );
  }

  const socket =
    options.createSocket?.() ?? createSocket({ type: "udp4", reuseAddr: true });
  const results = new Map<string, DiscoveredOpenCcu>();

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // A bind failure can emit an error before the UDP socket starts running.
      }
      if (error !== undefined) reject(error);
      else resolve([...results.values()].sort(compareDiscoveryResults));
    };

    socket.on("error", finish);
    socket.on("message", (message: Buffer, remote: RemoteInfo) => {
      const result = parseOpenCcuDiscoveryResponse(message, remote.address);
      if (result !== undefined)
        results.set(`${result.serial}\0${result.address}`, result);
    });
    socket.on("listening", () => {
      try {
        socket.setBroadcast(true);
        for (const address of [broadcastAddress, ...unicastAddresses]) {
          socket.send(
            OPENCCU_DISCOVERY_MESSAGE,
            OPENCCU_DISCOVERY_PORT,
            address,
          );
        }
        timer = setTimeout(() => finish(), timeoutMs);
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new Error("OpenCCU discovery failed"),
        );
      }
    });
    socket.bind(OPENCCU_DISCOVERY_CLIENT_PORT);
  });
}

export function parseOpenCcuDiscoveryResponse(
  message: Buffer,
  remoteAddress: string,
): DiscoveredOpenCcu | undefined {
  if (isIP(remoteAddress) === 0 || message.length <= DISCOVERY_HEADER_LENGTH) {
    return undefined;
  }
  if (
    !message
      .subarray(0, DISCOVERY_HEADER_LENGTH)
      .equals(OPENCCU_DISCOVERY_HEADER)
  ) {
    return undefined;
  }
  const typeEnd = message.indexOf(0x00, DISCOVERY_HEADER_LENGTH);
  if (typeEnd <= DISCOVERY_HEADER_LENGTH) return undefined;
  const serialStart = typeEnd + 1;
  const serialEnd = message.indexOf(0x00, serialStart);
  if (serialEnd <= serialStart) return undefined;

  const type = parseDiscoveryField(
    message.subarray(DISCOVERY_HEADER_LENGTH, typeEnd),
  );
  const serial = parseDiscoveryField(message.subarray(serialStart, serialEnd));
  if (type === undefined || serial === undefined) return undefined;
  return { address: remoteAddress, type, serial };
}

function parseDiscoveryField(value: Buffer): string | undefined {
  if (value.length === 0 || value.length > MAX_DISCOVERY_FIELD_LENGTH)
    return undefined;
  const text = value.toString("utf8");
  return /^[\x20-\x7e]+$/u.test(text) ? text : undefined;
}

function compareDiscoveryResults(
  left: DiscoveredOpenCcu,
  right: DiscoveredOpenCcu,
): number {
  return (
    left.serial.localeCompare(right.serial) ||
    left.address.localeCompare(right.address)
  );
}
