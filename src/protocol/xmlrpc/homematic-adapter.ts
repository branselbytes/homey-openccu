import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Socket } from "node:net";

import * as xmlrpc from "homematic-xmlrpc";

import { toProtocolError } from "../errors";
import { XmlRpcCallbackDispatcher } from "./callback-dispatcher";
import { HmIpXmlRpcClient, type HmIpXmlRpcClientOptions } from "./client";

export const DEFAULT_HMIP_RF_XML_RPC_PORT = 2010;

export interface HmIpXmlRpcEndpoint extends HmIpXmlRpcClientOptions {
  readonly host: string;
  readonly port?: number;
  readonly path?: string;
  readonly username?: string;
  readonly password?: string;
}

export function createHmIpXmlRpcClient(endpoint: HmIpXmlRpcEndpoint): HmIpXmlRpcClient {
  if ((endpoint.username === undefined) !== (endpoint.password === undefined)) {
    throw new Error("XML-RPC username and password must be set together");
  }
  return new HmIpXmlRpcClient(
    xmlrpc.createClient({
      host: endpoint.host,
      port: endpoint.port ?? DEFAULT_HMIP_RF_XML_RPC_PORT,
      ...(endpoint.path === undefined ? {} : { path: endpoint.path }),
      ...(endpoint.username === undefined
        ? {}
        : { basic_auth: { user: endpoint.username, pass: endpoint.password as string } }),
    }),
    {
      timeoutMs: endpoint.timeoutMs,
      writeTimeoutMs: endpoint.writeTimeoutMs,
      maxConcurrentRequests: endpoint.maxConcurrentRequests,
    },
  );
}

export interface XmlRpcCallbackServerOptions {
  readonly host: string;
  readonly port: number;
  readonly expectedRemoteHost: string;
  readonly dispatcher: XmlRpcCallbackDispatcher;
}

export class XmlRpcCallbackServer {
  readonly #server: xmlrpc.Server;
  readonly #ready: Promise<void>;

  constructor(options: XmlRpcCallbackServerOptions) {
    let markReady: (() => void) | undefined;
    this.#ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    this.#server = xmlrpc.createServer({ host: options.host, port: options.port }, () =>
      markReady?.(),
    );
    this.#server.httpServer.prependListener("connection", (socket: Socket) => {
      void authorizeRemoteSocket(socket, options.expectedRemoteHost);
    });
    registerCallbackMethods(this.#server, options.dispatcher);
  }

  ready(): Promise<void> {
    return this.#ready;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => this.#server.close(resolve));
  }
}

interface RemoteSocket {
  readonly remoteAddress?: string;
  pause(): unknown;
  resume(): unknown;
  destroy(): unknown;
}

type HostResolver = (host: string) => Promise<ReadonlySet<string>>;

export async function authorizeRemoteSocket(
  socket: RemoteSocket,
  expectedHost: string,
  resolveHost: HostResolver = resolveHostAddresses,
): Promise<boolean> {
  socket.pause();
  try {
    const addresses = await resolveHost(expectedHost);
    const remoteAddress = normalizeIpAddress(socket.remoteAddress);
    if (remoteAddress !== undefined && addresses.has(remoteAddress)) {
      socket.resume();
      return true;
    }
  } catch {
    // Resolution failure denies the connection. The supervisor continues to
    // retry registration and later callback connections resolve again.
  }
  socket.destroy();
  return false;
}

async function resolveHostAddresses(host: string): Promise<ReadonlySet<string>> {
  const literal = normalizeIpAddress(host);
  if (literal !== undefined && isIP(literal) !== 0) return new Set([literal]);
  const addresses = await lookup(host, { all: true, verbatim: true });
  return new Set(
    addresses
      .map(({ address }) => normalizeIpAddress(address))
      .filter((address): address is string => address !== undefined),
  );
}

function normalizeIpAddress(address: string | undefined): string | undefined {
  if (address === undefined || address === "") return undefined;
  if (address.startsWith("::ffff:")) return address.slice("::ffff:".length);
  const zoneIndex = address.indexOf("%");
  return (zoneIndex === -1 ? address : address.slice(0, zoneIndex)).toLowerCase();
}

export interface CallbackMethodRegistry {
  on(
    method: string,
    listener: (error: unknown, params: unknown[], callback: xmlrpc.ServerCallback) => void,
  ): unknown;
}

export function registerCallbackMethods(
  server: CallbackMethodRegistry,
  dispatcher: XmlRpcCallbackDispatcher,
): void {
  const methods = [
    "event",
    "system.multicall",
    "newDevices",
    "deleteDevices",
    "updateDevice",
    "listDevices",
    "system.listMethods",
  ];
  for (const method of methods) {
    server.on(method, (_error, params, callback) => {
      dispatcher.dispatch(method, params).then(
        (value) => callback(null, value),
        (error: unknown) => callback(toProtocolError(error, `XML-RPC callback ${method}`), ""),
      );
    });
  }
}
