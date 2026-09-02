import type { OpenCcuDevice } from "../domain/model";
import { TypedEventBus, type Unsubscribe } from "../events/event-bus";
import type { OpenCcuEvents } from "../events/openccu-events";
import type { ConnectionState } from "../protocol/connection-supervisor";
import { XmlRpcCallbackDispatcher } from "../protocol/xmlrpc/callback-dispatcher";
import type { XmlRpcClient } from "../protocol/xmlrpc/types";
import type { RpcValue } from "../protocol/xmlrpc/types";
import { createPairingCandidates, type PairingCandidate } from "../pairing/candidates";
import { transformFromOpenCcu, transformToOpenCcu } from "../mapping/transforms";
import type { CapabilityBinding } from "../mapping/types";
import { discoverHmIpDevices, type HmIpDiscoveryResult } from "./discovery";

export interface OpenCcuRuntimeOptions {
  readonly centralId: string;
  readonly interfaceId: string;
  readonly discoveryConcurrency?: number;
}

export class OpenCcuRuntime {
  readonly #client: XmlRpcClient;
  readonly #options: OpenCcuRuntimeOptions;
  readonly #events = new TypedEventBus<OpenCcuEvents>();
  #discovery?: HmIpDiscoveryResult;

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

  async refresh(signal?: AbortSignal): Promise<HmIpDiscoveryResult> {
    const discovery = await discoverHmIpDevices(
      this.#client,
      {
        centralId: this.#options.centralId,
        interfaceId: this.#options.interfaceId,
        concurrency: this.#options.discoveryConcurrency,
      },
      signal,
    );
    this.#discovery = discovery;
    return discovery;
  }

  pairingCandidates(names?: ReadonlyMap<string, string>): readonly PairingCandidate[] {
    return createPairingCandidates(this.devices, {
      centralId: this.#options.centralId,
      interfaceId: this.#options.interfaceId,
      names,
    });
  }

  async read(binding: CapabilityBinding, signal?: AbortSignal): Promise<RpcValue> {
    if (!binding.readable) throw new Error(`Capability ${binding.capability} is not readable`);
    const value = await this.#client.getValue(binding.channelAddress, binding.parameter, signal);
    return transformFromOpenCcu(binding.transform, value);
  }

  async write(
    binding: CapabilityBinding,
    value: RpcValue,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!binding.writable || !binding.writeChannelAddress || !binding.writeParameter) {
      throw new Error(`Capability ${binding.capability} is not writable`);
    }
    await this.#client.setValue(
      binding.writeChannelAddress,
      binding.writeParameter,
      transformToOpenCcu(binding.transform, value),
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
      onNewDevices: (interfaceId) =>
        this.#events.publish("devicesChanged", { interfaceId, reason: "new" }),
      onDeleteDevices: (interfaceId) =>
        this.#events.publish("devicesChanged", { interfaceId, reason: "delete" }),
      onUpdateDevice: (update) => {
        this.#events.publish("deviceUpdated", update);
        this.#events.publish("devicesChanged", {
          interfaceId: update.interfaceId,
          reason: "update",
        });
      },
    });
  }

  publishConnectionState(state: ConnectionState, error?: unknown): void {
    this.#events.publish("connection", {
      interfaceId: this.#options.interfaceId,
      state,
      ...(error === undefined ? {} : { error }),
    });
  }

  clearSubscriptions(): void {
    this.#events.clear();
  }
}
