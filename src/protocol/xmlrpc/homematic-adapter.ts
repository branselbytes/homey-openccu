import * as xmlrpc from "homematic-xmlrpc";

import { toProtocolError } from "../errors";
import { XmlRpcCallbackDispatcher } from "./callback-dispatcher";
import { HmIpXmlRpcClient, type HmIpXmlRpcClientOptions } from "./client";

export const DEFAULT_HMIP_RF_XML_RPC_PORT = 2010;

export interface HmIpXmlRpcEndpoint extends HmIpXmlRpcClientOptions {
  readonly host: string;
  readonly port?: number;
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
      ...(endpoint.username === undefined
        ? {}
        : { basic_auth: { user: endpoint.username, pass: endpoint.password as string } }),
    }),
    {
      timeoutMs: endpoint.timeoutMs,
      writeTimeoutMs: endpoint.writeTimeoutMs,
    },
  );
}

export interface XmlRpcCallbackServerOptions {
  readonly host: string;
  readonly port: number;
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
    registerCallbackMethods(this.#server, options.dispatcher);
  }

  ready(): Promise<void> {
    return this.#ready;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve) => this.#server.close(resolve));
  }
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
