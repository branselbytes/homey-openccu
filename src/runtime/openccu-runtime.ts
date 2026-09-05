import type { OpenCcuDevice } from "../domain/model";
import { TypedEventBus, type Unsubscribe } from "../events/event-bus";
import type { OpenCcuEvents } from "../events/openccu-events";
import type { ConnectionState } from "../protocol/connection-supervisor";
import { XmlRpcCallbackDispatcher } from "../protocol/xmlrpc/callback-dispatcher";
import type { XmlRpcClient } from "../protocol/xmlrpc/types";
import type { RpcValue } from "../protocol/xmlrpc/types";
import type { XmlRpcClientDiagnostics } from "../protocol/xmlrpc/types";
import {
  createPairingCandidates,
  type PairingCandidate,
} from "../pairing/candidates";
import {
  transformFromOpenCcu,
  transformToOpenCcu,
} from "../mapping/transforms";
import type { CapabilityBinding } from "../mapping/types";
import { ProfileRegistry } from "../profiles/registry";
import {
  descriptionCacheKey,
  discoverHmIpDevices,
  type DescriptionCache,
  type HmIpDiscoveryResult,
} from "./discovery";

export interface OpenCcuRuntimeOptions {
  readonly centralId: string;
  readonly interfaceId: string;
  readonly discoveryConcurrency?: number;
  readonly descriptionCache?: DescriptionCache;
}

export interface OpenCcuRuntimeDiagnostics {
  readonly connectionState: ConnectionState;
  readonly deviceCount: number;
  readonly discoveryIssueCount: number;
  readonly transport?: XmlRpcClientDiagnostics;
}

export class OpenCcuRuntime {
  readonly #client: XmlRpcClient;
  readonly #options: OpenCcuRuntimeOptions;
  readonly #events = new TypedEventBus<OpenCcuEvents>();
  readonly #profiles = new ProfileRegistry();
  #discovery?: HmIpDiscoveryResult;
  #connectionState: ConnectionState = "stopped";

  constructor(client: XmlRpcClient, options: OpenCcuRuntimeOptions) {
    this.#client = client;
    this.#options = options;
  }

  get devices(): ReadonlyMap<string, OpenCcuDevice> {
    return this.#discovery?.devices ?? new Map();
  }

  get discoveryIssues(): HmIpDiscoveryResult["issues"] {
    return this.#discovery?.issues ?? [];
  }

  get connectionState(): ConnectionState {
    return this.#connectionState;
  }

  getDiagnostics(): OpenCcuRuntimeDiagnostics {
    const transport = this.#client.getDiagnostics?.();
    return {
      connectionState: this.#connectionState,
      deviceCount: this.devices.size,
      discoveryIssueCount: this.discoveryIssues.length,
      ...(transport === undefined ? {} : { transport }),
    };
  }

  async refresh(signal?: AbortSignal): Promise<HmIpDiscoveryResult> {
    const discovery = await discoverHmIpDevices(
      this.#client,
      {
        centralId: this.#options.centralId,
        interfaceId: this.#options.interfaceId,
        concurrency: this.#options.discoveryConcurrency,
        descriptionCache: this.#options.descriptionCache,
        configurationParameters: (deviceType) =>
          this.#profiles.configurationParameters(deviceType),
      },
      signal,
    );
    this.#discovery = discovery;
    return discovery;
  }

  pairingCandidates(
    names?: ReadonlyMap<string, string>,
  ): readonly PairingCandidate[] {
    return createPairingCandidates(this.devices, {
      centralId: this.#options.centralId,
      interfaceId: this.#options.interfaceId,
      names,
      profiles: this.#profiles,
    });
  }

  async read(
    binding: CapabilityBinding,
    signal?: AbortSignal,
  ): Promise<RpcValue> {
    if (!binding.readable)
      throw new Error(`Capability ${binding.capability} is not readable`);
    const values = await this.#client.getParamset(
      binding.channelAddress,
      "VALUES",
      signal,
    );
    if (!(binding.parameter in values)) {
      throw new Error(`OpenCCU channel does not expose ${binding.parameter}`);
    }
    const value = values[binding.parameter];
    return transformFromOpenCcu(binding.transform, value);
  }

  readChannelValues(
    channelAddress: string,
    signal?: AbortSignal,
  ): Promise<Readonly<Record<string, RpcValue>>> {
    return this.#client.getParamset(channelAddress, "VALUES", signal);
  }

  async write(
    binding: CapabilityBinding,
    value: RpcValue,
    signal?: AbortSignal,
  ): Promise<void> {
    if (
      !binding.writable ||
      !binding.writeChannelAddress ||
      !binding.writeParameter
    ) {
      throw new Error(`Capability ${binding.capability} is not writable`);
    }
    if (binding.writeStrategy === "siren-default") {
      if (typeof value !== "boolean")
        throw new TypeError("Unsupported Homey siren state");
      await this.#client.putParamset(
        binding.writeChannelAddress,
        "VALUES",
        value
          ? {
              ACOUSTIC_ALARM_SELECTION: "FREQUENCY_RISING_AND_FALLING",
              OPTICAL_ALARM_SELECTION: "BLINKING_ALTERNATELY_REPEATING",
              DURATION_UNIT: "S",
              DURATION_VALUE: 30,
            }
          : {
              ACOUSTIC_ALARM_SELECTION: "DISABLE_ACOUSTIC_SIGNAL",
              OPTICAL_ALARM_SELECTION: "DISABLE_OPTICAL_SIGNAL",
              DURATION_UNIT: "S",
              DURATION_VALUE: 0,
            },
        signal,
      );
      return;
    }
    const operation = resolveWriteOperation(binding, value);
    await this.#client.setValue(
      binding.writeChannelAddress,
      operation.parameter,
      operation.value,
      signal,
    );
  }

  subscribe<Key extends keyof OpenCcuEvents>(
    key: Key,
    listener: (event: OpenCcuEvents[Key]) => void,
  ): Unsubscribe {
    return this.#events.subscribe(key, listener);
  }

  createCallbackDispatcher(): XmlRpcCallbackDispatcher {
    return new XmlRpcCallbackDispatcher({
      onEvent: (event) => this.#events.publish("datapoint", event),
      onNewDevices: async (interfaceId, devices) => {
        if (this.#discovery !== undefined) {
          await this.#invalidateDescriptions(
            devices.map(({ ADDRESS }) => ADDRESS),
          );
        }
        this.#events.publish("devicesChanged", { interfaceId, reason: "new" });
      },
      onDeleteDevices: async (interfaceId, addresses) => {
        if (this.#discovery !== undefined)
          await this.#invalidateDescriptions(addresses);
        this.#events.publish("devicesChanged", {
          interfaceId,
          reason: "delete",
        });
      },
      onUpdateDevice: (update) => {
        if (this.#discovery !== undefined) {
          void this.#invalidateDescriptions([update.address]);
        }
        this.#events.publish("deviceUpdated", update);
        this.#events.publish("devicesChanged", {
          interfaceId: update.interfaceId,
          reason: "update",
        });
      },
    });
  }

  publishConnectionState(state: ConnectionState, error?: unknown): void {
    this.#connectionState = state;
    this.#events.publish("connection", {
      interfaceId: this.#options.interfaceId,
      state,
      ...(error === undefined ? {} : { error }),
    });
  }

  clearSubscriptions(): void {
    this.#events.clear();
  }

  async #invalidateDescriptions(addresses: readonly string[]): Promise<void> {
    const cache = this.#options.descriptionCache;
    if (cache === undefined) return;
    const expanded = new Set(addresses);
    for (const description of this.#discovery?.descriptions ?? []) {
      if (description.PARENT && addresses.includes(description.PARENT)) {
        expanded.add(description.ADDRESS);
      }
    }
    await Promise.all(
      [...expanded]
        .filter((address) => address.includes(":"))
        .map((address) =>
          cache.delete(
            descriptionCacheKey(
              this.#options.centralId,
              this.#options.interfaceId,
              address,
            ),
          ),
        ),
    );
  }
}

function resolveWriteOperation(
  binding: CapabilityBinding,
  value: RpcValue,
): { readonly parameter: string; readonly value: RpcValue } {
  if (binding.writeStrategy === "cover-state") {
    if (value === "up") return { parameter: "LEVEL", value: 1 };
    if (value === "down") return { parameter: "LEVEL", value: 0 };
    if (value === "idle") return { parameter: "STOP", value: true };
    throw new TypeError("Unsupported Homey cover state");
  }
  if (binding.writeStrategy === "garage-closed") {
    if (typeof value !== "boolean")
      throw new TypeError("Unsupported Homey garage door state");
    return {
      parameter: "DOOR_COMMAND",
      value: value ? "CLOSE" : "OPEN",
    };
  }
  if (binding.writeStrategy === "smoke-siren") {
    if (typeof value !== "boolean")
      throw new TypeError("Unsupported Homey smoke siren state");
    return {
      parameter: "SMOKE_DETECTOR_COMMAND",
      value: value ? "INTRUSION_ALARM" : "INTRUSION_ALARM_OFF",
    };
  }
  return {
    parameter: binding.writeParameter as string,
    value: transformToOpenCcu(binding.transform, value),
  };
}
