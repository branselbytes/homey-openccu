import type { OpenCcuConnectionConfig } from "../config/openccu-config";
import {
  ConnectionSupervisor,
  type ConnectionState,
} from "../protocol/connection-supervisor";
import {
  createHmIpXmlRpcClient,
  XmlRpcCallbackServer,
} from "../protocol/xmlrpc/homematic-adapter";
import type { XmlRpcClient } from "../protocol/xmlrpc/types";
import {
  OpenCcuJsonRpcClient,
  OpenCcuJsonRpcSession,
} from "../protocol/jsonrpc/client";
import type {
  JsonRpcSession,
  OpenCcuMetadataResult,
} from "../protocol/jsonrpc/metadata";
import type { RuntimeFactory } from "./application-lifecycle";
import { OpenCcuRuntime } from "./openccu-runtime";
import type { DescriptionCache } from "./discovery";

export const HMIP_RF_INTERFACE_ID = "HmIP-RF";

export interface CallbackServer {
  ready(): Promise<void>;
  close(): Promise<void>;
}

export interface ManagedCentralRuntimeFactoryOptions {
  readonly callbackBindHost?: string;
  readonly callbackAdvertisedHost: string;
  readonly createClient?: (config: OpenCcuConnectionConfig) => XmlRpcClient;
  readonly createJsonRpcSession?: (
    config: OpenCcuConnectionConfig,
  ) =>
    | (JsonRpcSession & { close(signal?: AbortSignal): Promise<void> })
    | undefined;
  readonly createCallbackServer?: (options: {
    readonly host: string;
    readonly port: number;
    readonly expectedRemoteHost: string;
    readonly runtime: OpenCcuRuntime;
  }) => CallbackServer;
  readonly initialRetryDelayMs?: number;
  readonly maxRetryDelayMs?: number;
  readonly descriptionCache?: DescriptionCache;
  readonly onConnectionState?: (
    centralId: string,
    state: ConnectionState,
    error?: unknown,
  ) => void;
  readonly onMetadataLoaded?: (
    centralId: string,
    result: OpenCcuMetadataResult,
  ) => void;
}

export class ManagedCentralRuntime {
  readonly core: OpenCcuRuntime;
  readonly #supervisor: ConnectionSupervisor;
  readonly #callbackServer: CallbackServer;
  #started = false;

  constructor(
    core: OpenCcuRuntime,
    supervisor: ConnectionSupervisor,
    callbackServer: CallbackServer,
  ) {
    this.core = core;
    this.#supervisor = supervisor;
    this.#callbackServer = callbackServer;
  }

  async start(): Promise<void> {
    if (this.#started) return;
    await this.#callbackServer.ready();
    this.#supervisor.start();
    this.#started = true;
  }

  async stop(): Promise<void> {
    try {
      await this.#supervisor.stop();
    } finally {
      try {
        await this.#callbackServer.close();
      } finally {
        this.core.clearSubscriptions();
        this.#started = false;
      }
    }
  }
}

export class ManagedCentralRuntimeFactory implements RuntimeFactory<ManagedCentralRuntime> {
  readonly #options: ManagedCentralRuntimeFactoryOptions;

  constructor(options: ManagedCentralRuntimeFactoryOptions) {
    this.#options = options;
  }

  async create(
    config: OpenCcuConnectionConfig,
  ): Promise<ManagedCentralRuntime> {
    const client =
      this.#options.createClient?.(config) ??
      createHmIpXmlRpcClient({
        host: config.host,
        port: config.hmIpRfPort,
        username: config.username,
        password: config.password,
      });
    const jsonRpcSession =
      this.#options.createJsonRpcSession?.(config) ??
      createJsonRpcSession(config);
    const core = new OpenCcuRuntime(client, {
      centralId: config.centralId,
      interfaceId: HMIP_RF_INTERFACE_ID,
      descriptionCache: this.#options.descriptionCache,
      jsonRpcSession,
    });
    const callbackServer =
      this.#options.createCallbackServer?.({
        host: this.#options.callbackBindHost ?? "0.0.0.0",
        port: config.callbackPort,
        expectedRemoteHost: config.host,
        runtime: core,
      }) ??
      new XmlRpcCallbackServer({
        host: this.#options.callbackBindHost ?? "0.0.0.0",
        port: config.callbackPort,
        expectedRemoteHost: config.host,
        dispatcher: core.createCallbackDispatcher(),
      });
    const callbackUrl = buildCallbackUrl(
      this.#options.callbackAdvertisedHost,
      config.callbackPort,
    );
    const supervisor = new ConnectionSupervisor({
      connect: async (signal) => {
        await client.init(callbackUrl, HMIP_RF_INTERFACE_ID, signal);
        await core.refresh(signal);
        if (jsonRpcSession !== undefined) {
          const result = await core.refreshMetadata(signal);
          if (result !== undefined) {
            this.#options.onMetadataLoaded?.(config.centralId, result);
          }
        }
      },
      disconnect: async () => {
        try {
          await client
            .init("", HMIP_RF_INTERFACE_ID, AbortSignal.timeout(2_000))
            .catch(() => undefined);
        } finally {
          await jsonRpcSession
            ?.close(AbortSignal.timeout(2_000))
            .catch(() => undefined);
        }
      },
      initialDelayMs: this.#options.initialRetryDelayMs,
      maxDelayMs: this.#options.maxRetryDelayMs,
      onStateChange: (state, error) => {
        core.publishConnectionState(state, error);
        this.#options.onConnectionState?.(config.centralId, state, error);
      },
    });
    const runtime = new ManagedCentralRuntime(core, supervisor, callbackServer);
    await runtime.start();
    return runtime;
  }
}

function createJsonRpcSession(
  config: OpenCcuConnectionConfig,
): OpenCcuJsonRpcSession | undefined {
  if (config.username === undefined || config.password === undefined) {
    return undefined;
  }
  return new OpenCcuJsonRpcSession({
    client: new OpenCcuJsonRpcClient({
      endpoint: config.jsonRpcUrl,
      username: config.username,
      password: config.password,
    }),
    username: config.username,
    password: config.password,
  });
}

export function buildCallbackUrl(host: string, port: number): string {
  const urlHost =
    host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
  return `http://${urlHost}:${port}`;
}
