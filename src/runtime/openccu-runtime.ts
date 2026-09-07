import type { OpenCcuDevice, OpenCcuMetadata } from "../domain/model";
import { TypedEventBus, type Unsubscribe } from "../events/event-bus";
import type { OpenCcuEvents } from "../events/openccu-events";
import type { ConnectionState } from "../protocol/connection-supervisor";
import { XmlRpcCallbackDispatcher } from "../protocol/xmlrpc/callback-dispatcher";
import type { XmlRpcClient } from "../protocol/xmlrpc/types";
import type { RpcValue } from "../protocol/xmlrpc/types";
import type { XmlRpcClientDiagnostics } from "../protocol/xmlrpc/types";
import type {
  JsonRpcSession,
  MetadataIssue,
  OpenCcuMetadataResult,
} from "../protocol/jsonrpc/metadata";
import {
  executeOpenCcuProgram,
  loadOpenCcuMetadata,
  setOpenCcuSystemVariable,
} from "../protocol/jsonrpc/metadata";
import {
  loadOpenCcuServiceMessages,
  type OpenCcuServiceMessage,
} from "../protocol/jsonrpc/service-messages";
import {
  loadOpenCcuSystemInformation,
  type OpenCcuSystemInformation,
  type OpenCcuSystemInformationResult,
} from "../protocol/jsonrpc/system-information";
import {
  createPairingCandidates,
  type PairingCandidate,
} from "../pairing/candidates";
import { resolveDeviceMappings } from "../mapping/device-resolver";
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
  readonly jsonRpcSession?: JsonRpcSession;
}

export interface OpenCcuRuntimeDiagnostics {
  readonly connectionState: ConnectionState;
  readonly deviceCount: number;
  readonly discoveryIssueCount: number;
  readonly metadataIssueCount: number;
  readonly systemInformationIssueCount: number;
  readonly radioInterfaceCount: number;
  readonly metadataCounts: {
    readonly names: number;
    readonly rooms: number;
    readonly functions: number;
    readonly programs: number;
    readonly systemVariables: number;
  };
  readonly transport?: XmlRpcClientDiagnostics;
  readonly devices: readonly OpenCcuDeviceDiagnostics[];
}

export interface OpenCcuDeviceDiagnostics {
  readonly alias: string;
  readonly type: string;
  readonly firmware?: string;
  readonly availability: OpenCcuDevice["availability"];
  readonly channels: readonly {
    readonly index?: number;
    readonly type: string;
    readonly dataPoints: readonly {
      readonly parameter: string;
      readonly type: string;
      readonly operations: number;
      readonly flags: number;
      readonly unit?: string;
      readonly min?: number;
      readonly max?: number;
      readonly valueList?: readonly string[];
    }[];
  }[];
  readonly mappings: readonly {
    readonly driverId: string;
    readonly profileId?: string;
    readonly logicalId?: string;
    readonly generic: boolean;
    readonly capabilities: readonly string[];
  }[];
}

export class OpenCcuRuntime {
  readonly #client: XmlRpcClient;
  readonly #options: OpenCcuRuntimeOptions;
  readonly #events = new TypedEventBus<OpenCcuEvents>();
  readonly #profiles = new ProfileRegistry();
  #discovery?: HmIpDiscoveryResult;
  #metadata: OpenCcuMetadata = emptyMetadata();
  #metadataIssues: readonly MetadataIssue[] = [];
  #systemInformation?: OpenCcuSystemInformation;
  #systemInformationIssues: readonly MetadataIssue[] = [];
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

  get metadata(): OpenCcuMetadata {
    return this.#metadata;
  }

  get metadataIssues(): readonly MetadataIssue[] {
    return this.#metadataIssues;
  }

  get systemInformation(): OpenCcuSystemInformation | undefined {
    return this.#systemInformation;
  }

  get systemInformationIssues(): readonly MetadataIssue[] {
    return this.#systemInformationIssues;
  }

  getDiagnostics(): OpenCcuRuntimeDiagnostics {
    const transport = this.#client.getDiagnostics?.();
    return {
      connectionState: this.#connectionState,
      deviceCount: this.devices.size,
      discoveryIssueCount: this.discoveryIssues.length,
      metadataIssueCount: this.#metadataIssues.length,
      systemInformationIssueCount: this.#systemInformationIssues.length,
      radioInterfaceCount: this.#systemInformation?.radioInterfaces.length ?? 0,
      metadataCounts: {
        names: this.#metadata.names.size,
        rooms: this.#metadata.rooms.size,
        functions: this.#metadata.functions.size,
        programs: this.#metadata.programs.length,
        systemVariables: this.#metadata.systemVariables.length,
      },
      ...(transport === undefined ? {} : { transport }),
      devices: [...this.devices.values()].map((device, index) =>
        createDeviceDiagnostics(device, index),
      ),
    };
  }

  updateMetadata(result: OpenCcuMetadataResult): void {
    this.#metadata = result.metadata;
    this.#metadataIssues = result.issues;
    this.#events.publish("metadata", this.#metadata);
  }

  async refreshMetadata(
    signal?: AbortSignal,
  ): Promise<OpenCcuMetadataResult | undefined> {
    if (this.#options.jsonRpcSession === undefined) return undefined;
    const result = await loadOpenCcuMetadata(
      this.#options.jsonRpcSession,
      signal,
    );
    this.updateMetadata(result);
    return result;
  }

  async refreshSystemInformation(
    signal?: AbortSignal,
  ): Promise<OpenCcuSystemInformationResult | undefined> {
    if (this.#options.jsonRpcSession === undefined) return undefined;
    const result = await loadOpenCcuSystemInformation(
      this.#options.jsonRpcSession,
      this.#options.interfaceId,
      signal,
    );
    this.#systemInformation = result.information;
    this.#systemInformationIssues = result.issues;
    return result;
  }

  async loadServiceMessages(
    signal?: AbortSignal,
  ): Promise<readonly OpenCcuServiceMessage[]> {
    return loadOpenCcuServiceMessages(this.#requireJsonRpcSession(), signal);
  }

  async executeProgram(id: string, signal?: AbortSignal): Promise<void> {
    const session = this.#requireJsonRpcSession();
    if (!this.#metadata.programs.some((program) => program.id === id)) {
      throw new Error(`Unknown OpenCCU program ${id}`);
    }
    await executeOpenCcuProgram(session, id, signal);
  }

  async setSystemVariable(
    id: string,
    value: RpcValue,
    signal?: AbortSignal,
  ): Promise<void> {
    const session = this.#requireJsonRpcSession();
    const variable = this.#metadata.systemVariables.find(
      (candidate) => candidate.id === id,
    );
    if (variable === undefined) {
      throw new Error(`Unknown OpenCCU system variable ${id}`);
    }
    await setOpenCcuSystemVariable(
      session,
      id,
      normalizeSystemVariableInput(variable.type, value),
      signal,
    );
    await this.refreshMetadata(signal);
  }

  async systemVariableEquals(
    id: string,
    expected: RpcValue,
    signal?: AbortSignal,
  ): Promise<boolean> {
    await this.refreshMetadata(signal);
    const variable = this.#metadata.systemVariables.find(
      (candidate) => candidate.id === id,
    );
    if (variable === undefined) {
      throw new Error(`Unknown OpenCCU system variable ${id}`);
    }
    return (
      variable.value === normalizeSystemVariableInput(variable.type, expected)
    );
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
    names: ReadonlyMap<string, string> = this.#metadata.names,
  ): readonly PairingCandidate[] {
    return createPairingCandidates(this.devices, {
      centralId: this.#options.centralId,
      interfaceId: this.#options.interfaceId,
      names,
      metadata: this.#metadata,
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

  #requireJsonRpcSession(): JsonRpcSession {
    if (this.#options.jsonRpcSession === undefined) {
      throw new Error("OpenCCU JSON-RPC authentication is not configured");
    }
    return this.#options.jsonRpcSession;
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

function createDeviceDiagnostics(
  device: OpenCcuDevice,
  index: number,
): OpenCcuDeviceDiagnostics {
  return {
    alias: `device-${index + 1}`,
    type: device.type,
    ...(device.firmware === undefined ? {} : { firmware: device.firmware }),
    availability: device.availability,
    channels: [...device.channels.values()]
      .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
      .map((channel) => ({
        ...(channel.index === undefined ? {} : { index: channel.index }),
        type: channel.type,
        dataPoints: [...channel.dataPoints.values()]
          .sort((left, right) => left.parameter.localeCompare(right.parameter))
          .map(({ parameter, metadata }) => ({
            parameter,
            type: metadata.TYPE,
            operations: metadata.OPERATIONS,
            flags: metadata.FLAGS,
            ...(metadata.UNIT === undefined ? {} : { unit: metadata.UNIT }),
            ...(metadata.MIN === undefined ? {} : { min: metadata.MIN }),
            ...(metadata.MAX === undefined ? {} : { max: metadata.MAX }),
            ...(metadata.VALUE_LIST === undefined
              ? {}
              : { valueList: metadata.VALUE_LIST }),
          })),
      })),
    mappings: resolveDeviceMappings(device)
      .map((mapping) => ({
        driverId: mapping.driverId,
        ...(mapping.profileId === undefined
          ? {}
          : { profileId: mapping.profileId }),
        ...(mapping.logicalId === undefined
          ? {}
          : { logicalId: mapping.logicalId }),
        generic: mapping.generic,
        capabilities: [
          ...new Set(mapping.bindings.map(({ capability }) => capability)),
        ].sort(),
      }))
      .sort((left, right) => left.driverId.localeCompare(right.driverId)),
  };
}

function emptyMetadata(): OpenCcuMetadata {
  return {
    names: new Map(),
    rooms: new Map(),
    functions: new Map(),
    programs: [],
    systemVariables: [],
  };
}

function normalizeSystemVariableInput(type: string, value: RpcValue): RpcValue {
  if (type === "NUMBER") {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) {
      throw new TypeError("OpenCCU NUMBER variable requires a numeric value");
    }
    return number;
  }
  if (type === "ALARM" || type === "LOGIC") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true" || value === "1") return true;
      if (value.toLowerCase() === "false" || value === "0") return false;
    }
    throw new TypeError(`OpenCCU ${type} variable requires true or false`);
  }
  if (typeof value !== "string") {
    throw new TypeError(`OpenCCU ${type} variable requires a text value`);
  }
  return value;
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
