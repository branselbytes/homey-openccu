import type { OpenCcuDevice } from "../domain/model";
import { TypedEventBus, type Unsubscribe } from "../events/event-bus";
import type { OpenCcuEvents } from "../events/openccu-events";
import { XmlRpcCallbackDispatcher } from "../protocol/xmlrpc/callback-dispatcher";
import type { XmlRpcClient } from "../protocol/xmlrpc/types";
import { createPairingCandidates, type PairingCandidate } from "../pairing/candidates";
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

  clearSubscriptions(): void {
    this.#events.clear();
  }
}
