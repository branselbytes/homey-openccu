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
export const VIRTUAL_DEVICES_INTERFACE_ID = "VirtualDevices";

export interface CallbackServer {
  ready(): Promise<void>;
  close(): Promise<void>;
}

interface ManagedInterfaceRuntime {
  readonly interfaceId: string;
  readonly core: OpenCcuRuntime;
  readonly supervisor: ConnectionSupervisor;
  readonly callbackServer: CallbackServer;
}

export interface ManagedCentralRuntimeFactoryOptions {
  readonly callbackBindHost?: string;
  readonly callbackAdvertisedHost: string;
  readonly enableVirtualDevices?: boolean;
  readonly createClient?: (config: OpenCcuConnectionConfig) => XmlRpcClient;
  readonly createVirtualDevicesClient?: (
    config: OpenCcuConnectionConfig,
  ) => XmlRpcClient;
  readonly createJsonRpcSession?: (
    config: OpenCcuConnectionConfig,
  ) =>
    | (JsonRpcSession & { close(signal?: AbortSignal): Promise<void> })
    | undefined;
  readonly createCallbackServer?: (options: {
    readonly host: string;
    readonly port: number;
    readonly expectedRemoteHost: string;
    readonly interfaceId: string;
    readonly runtime: OpenCcuRuntime;
  }) => CallbackServer;
  readonly initialRetryDelayMs?: number;
  readonly maxRetryDelayMs?: number;
  readonly descriptionCache?: DescriptionCache;
  readonly onConnectionState?: (
    centralId: string,
    interfaceId: string,
    state: ConnectionState,
    error?: unknown,
  ) => void;
  readonly onMetadataLoaded?: (
    centralId: string,
    result: OpenCcuMetadataResult,
  ) => void;
}

export class ManagedCentralRuntime {
  readonly #interfaces: readonly ManagedInterfaceRuntime[];
  #started = false;

  constructor(interfaces: readonly ManagedInterfaceRuntime[]) {
    if (interfaces.length === 0) {
      throw new Error("Managed OpenCCU runtime requires an interface");
    }
    this.#interfaces = interfaces;
  }

  get core(): OpenCcuRuntime {
    const primary = this.getCore(HMIP_RF_INTERFACE_ID);
    if (primary === undefined) {
      throw new Error("Managed OpenCCU runtime has no HmIP-RF interface");
    }
    return primary;
  }

  getCore(interfaceId: string): OpenCcuRuntime | undefined {
    return this.#interfaces.find(
      (candidate) => candidate.interfaceId === interfaceId,
    )?.core;
  }

  interfaceCores(): readonly (readonly [string, OpenCcuRuntime])[] {
    return this.#interfaces.map(({ interfaceId, core }) => [interfaceId, core]);
  }

  async start(): Promise<void> {
    if (this.#started) return;
    await Promise.all(
      this.#interfaces.map(({ callbackServer }) => callbackServer.ready()),
    );
    for (const { supervisor } of this.#interfaces) supervisor.start();
    this.#started = true;
  }

  async stop(): Promise<void> {
    let firstError: unknown;
    for (const { supervisor } of this.#interfaces) {
      try {
        await supervisor.stop();
      } catch (error) {
        firstError ??= error;
      }
    }
    for (const { callbackServer, core } of this.#interfaces) {
      try {
        await callbackServer.close();
      } catch (error) {
        firstError ??= error;
      } finally {
        core.clearSubscriptions();
      }
    }
    this.#started = false;
    if (firstError !== undefined) {
      throw firstError instanceof Error
        ? firstError
        : new Error("Failed to stop OpenCCU runtime", { cause: firstError });
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
    const jsonRpcSession =
      this.#options.createJsonRpcSession?.(config) ??
      createJsonRpcSession(config);
    const interfaces: ManagedInterfaceRuntime[] = [
      this.#createInterface({
        config,
        interfaceId: HMIP_RF_INTERFACE_ID,
        callbackPort: config.callbackPort,
        client:
          this.#options.createClient?.(config) ??
          createHmIpXmlRpcClient({
            host: config.host,
            port: config.hmIpRfPort,
            username: config.username,
            password: config.password,
          }),
        jsonRpcSession,
      }),
    ];
    if (this.#options.enableVirtualDevices === true) {
      interfaces.push(
        this.#createInterface({
          config,
          interfaceId: VIRTUAL_DEVICES_INTERFACE_ID,
          callbackPort: config.virtualDevicesCallbackPort,
          client:
            this.#options.createVirtualDevicesClient?.(config) ??
            createHmIpXmlRpcClient({
              host: config.host,
              port: config.virtualDevicesPort,
              path: "/groups",
              username: config.username,
              password: config.password,
            }),
        }),
      );
    }
    const runtime = new ManagedCentralRuntime(interfaces);
    await runtime.start();
    return runtime;
  }

  #createInterface(options: {
    readonly config: OpenCcuConnectionConfig;
    readonly interfaceId: string;
    readonly callbackPort: number;
    readonly client: XmlRpcClient;
    readonly jsonRpcSession?: JsonRpcSession & {
      close(signal?: AbortSignal): Promise<void>;
    };
  }): ManagedInterfaceRuntime {
    const { config, interfaceId, client, jsonRpcSession } = options;
    const core = new OpenCcuRuntime(client, {
      centralId: config.centralId,
      interfaceId,
      descriptionCache: this.#options.descriptionCache,
      jsonRpcSession,
    });
    const callbackServer =
      this.#options.createCallbackServer?.({
        host: this.#options.callbackBindHost ?? "0.0.0.0",
        port: options.callbackPort,
        expectedRemoteHost: config.host,
        interfaceId,
        runtime: core,
      }) ??
      new XmlRpcCallbackServer({
        host: this.#options.callbackBindHost ?? "0.0.0.0",
        port: options.callbackPort,
        expectedRemoteHost: config.host,
        dispatcher: core.createCallbackDispatcher(),
      });
    const callbackUrl = buildCallbackUrl(
      this.#options.callbackAdvertisedHost,
      options.callbackPort,
    );
    const supervisor = new ConnectionSupervisor({
      connect: async (signal) => {
        await client.init(callbackUrl, interfaceId, signal);
        await core.refresh(signal);
        if (jsonRpcSession !== undefined) {
          const metadataResult = await core.refreshMetadata(signal);
          await core.refreshSystemInformation(signal);
          if (metadataResult !== undefined) {
            this.#options.onMetadataLoaded?.(config.centralId, metadataResult);
          }
        }
      },
      disconnect: async () => {
        try {
          await client
            .init("", interfaceId, AbortSignal.timeout(2_000))
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
        this.#options.onConnectionState?.(
          config.centralId,
          interfaceId,
          state,
          error,
        );
      },
    });
    return { interfaceId, core, supervisor, callbackServer };
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
