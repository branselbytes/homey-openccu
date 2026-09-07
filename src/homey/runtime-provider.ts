import type { PairingCandidate } from "../pairing/candidates";
import type { ManagedCentralRuntime } from "../runtime/managed-central-runtime";
import type { OpenCcuRuntime } from "../runtime/openccu-runtime";
import type { OpenCcuRuntimeDiagnostics } from "../runtime/openccu-runtime";
import { HMIP_RF_INTERFACE_ID } from "../runtime/managed-central-runtime";

export interface ManagedRuntimeSource {
  getRuntime(centralId: string): ManagedCentralRuntime | undefined;
  runtimeEntries(): readonly (readonly [string, ManagedCentralRuntime])[];
}

export interface HubFlowOption {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export interface SystemPairingCandidate {
  readonly name: string;
  readonly data: {
    readonly id: string;
    readonly centralId: string;
  };
}

export interface ServiceMessageView {
  readonly id: string;
  readonly code: string;
  readonly type: number;
  readonly deviceName?: string;
  readonly occurredAt?: string;
  readonly lastOccurredAt?: string;
  readonly occurrenceCount: number;
}

export interface CentralServiceMessagesView {
  readonly centralId: string;
  readonly connectionState: string;
  readonly messages: readonly ServiceMessageView[];
  readonly unavailable?: true;
}

export interface ServiceMessageOverview {
  readonly refreshedAt: string;
  readonly centrals: readonly CentralServiceMessagesView[];
}

export interface RadioInterfaceStatusView {
  readonly name?: string;
  readonly type?: string;
  readonly dutyCycle?: number;
  readonly carrierSense?: number;
}

export interface CentralSystemStatusView {
  readonly centralId: string;
  readonly connectionState: string;
  readonly deviceCount: number;
  readonly serviceMessageCount?: number;
  readonly dutyCycle?: number;
  readonly carrierSense?: number;
  readonly radioInterfaces: readonly RadioInterfaceStatusView[];
  readonly partial?: true;
  readonly unavailable?: true;
}

export interface SystemStatusOverview {
  readonly refreshedAt: string;
  readonly centrals: readonly CentralSystemStatusView[];
}

export class OpenCcuRuntimeProvider {
  readonly #source: ManagedRuntimeSource;
  #serviceMessageCache?: {
    readonly expiresAt: number;
    readonly value: ServiceMessageOverview;
  };
  #serviceMessageRequest?: Promise<ServiceMessageOverview>;
  #systemStatusCache?: {
    readonly expiresAt: number;
    readonly value: SystemStatusOverview;
  };
  #systemStatusRequest?: Promise<SystemStatusOverview>;

  constructor(source: ManagedRuntimeSource) {
    this.#source = source;
  }

  get(
    centralId: string,
    interfaceId = HMIP_RF_INTERFACE_ID,
  ): OpenCcuRuntime | undefined {
    return this.#source.getRuntime(centralId)?.getCore(interfaceId);
  }

  pairingCandidates(driverId: string): readonly PairingCandidate[] {
    return this.#source
      .runtimeEntries()
      .flatMap(([, runtime]) =>
        runtime
          .interfaceCores()
          .flatMap(([, core]) =>
            core.pairingCandidates(runtime.core.metadata.names),
          ),
      )
      .filter((candidate) => candidate.driverId === driverId);
  }

  systemPairingCandidates(): readonly SystemPairingCandidate[] {
    return this.#source.runtimeEntries().map(([centralId]) => ({
      name: `OpenCCU (${centralId})`,
      data: { id: `openccu-system:${centralId}`, centralId },
    }));
  }

  async serviceMessageOverview(): Promise<ServiceMessageOverview> {
    const now = Date.now();
    if (
      this.#serviceMessageCache !== undefined &&
      this.#serviceMessageCache.expiresAt > now
    ) {
      return this.#serviceMessageCache.value;
    }
    this.#serviceMessageRequest ??= this.#loadServiceMessageOverview();
    try {
      const value = await this.#serviceMessageRequest;
      this.#serviceMessageCache = { expiresAt: now + 30_000, value };
      return value;
    } finally {
      this.#serviceMessageRequest = undefined;
    }
  }

  async systemStatusOverview(): Promise<SystemStatusOverview> {
    const now = Date.now();
    if (
      this.#systemStatusCache !== undefined &&
      this.#systemStatusCache.expiresAt > now
    ) {
      return this.#systemStatusCache.value;
    }
    this.#systemStatusRequest ??= this.#loadSystemStatusOverview();
    try {
      const value = await this.#systemStatusRequest;
      this.#systemStatusCache = { expiresAt: now + 30_000, value };
      return value;
    } finally {
      this.#systemStatusRequest = undefined;
    }
  }

  diagnostics(): readonly {
    readonly centralId: string;
    readonly runtime: OpenCcuRuntimeDiagnostics;
  }[] {
    return this.#source.runtimeEntries().map(([centralId, runtime]) => ({
      centralId,
      runtime: runtime.core.getDiagnostics(),
    }));
  }

  programOptions(query = ""): readonly HubFlowOption[] {
    return this.#source.runtimeEntries().flatMap(([centralId, runtime]) =>
      runtime.core.metadata.programs
        .filter(({ name }) => matchesQuery(name, query))
        .map(({ id, name }) => ({
          id: encodeHubId(centralId, id),
          name,
          description: centralId,
        })),
    );
  }

  systemVariableOptions(query = ""): readonly HubFlowOption[] {
    return this.#source.runtimeEntries().flatMap(([centralId, runtime]) =>
      runtime.core.metadata.systemVariables
        .filter(({ name }) => matchesQuery(name, query))
        .map(({ id, name, type }) => ({
          id: encodeHubId(centralId, id),
          name,
          description: `${type} · ${centralId}`,
        })),
    );
  }

  executeProgram(option: unknown): Promise<void> {
    const { centralId, objectId } = parseHubOption(option);
    return this.#requireRuntime(centralId).executeProgram(objectId);
  }

  setSystemVariable(option: unknown, value: string): Promise<void> {
    const { centralId, objectId } = parseHubOption(option);
    return this.#requireRuntime(centralId).setSystemVariable(objectId, value);
  }

  systemVariableEquals(option: unknown, value: string): Promise<boolean> {
    const { centralId, objectId } = parseHubOption(option);
    return this.#requireRuntime(centralId).systemVariableEquals(
      objectId,
      value,
    );
  }

  async #loadServiceMessageOverview(): Promise<ServiceMessageOverview> {
    const centrals = await Promise.all(
      this.#source.runtimeEntries().map(async ([centralId, runtime]) => {
        try {
          const messages = await runtime.core.loadServiceMessages();
          return {
            centralId,
            connectionState: runtime.core.connectionState,
            messages: messages.map((message) => ({
              id: message.id,
              code: message.code,
              type: message.type,
              occurrenceCount: message.occurrenceCount,
              deviceName:
                message.deviceName ??
                (message.address === undefined
                  ? undefined
                  : runtime.core.metadata.names.get(message.address)),
              ...(message.occurredAt === undefined
                ? {}
                : { occurredAt: message.occurredAt }),
              ...(message.lastOccurredAt === undefined
                ? {}
                : { lastOccurredAt: message.lastOccurredAt }),
            })),
          } satisfies CentralServiceMessagesView;
        } catch {
          return {
            centralId,
            connectionState: runtime.core.connectionState,
            messages: [],
            unavailable: true,
          } satisfies CentralServiceMessagesView;
        }
      }),
    );
    return { refreshedAt: new Date().toISOString(), centrals };
  }

  async #loadSystemStatusOverview(): Promise<SystemStatusOverview> {
    const centrals = await Promise.all(
      this.#source.runtimeEntries().map(async ([centralId, runtime]) => {
        const core = runtime.core;
        let information = core.systemInformation;
        let partial = core.systemInformationIssues.length > 0;
        let unavailable = core.connectionState !== "healthy";
        if (!unavailable) {
          try {
            const result = await core.refreshSystemInformation();
            if (result === undefined) {
              unavailable = true;
            } else {
              information = result.information;
              partial = result.issues.length > 0;
            }
          } catch {
            unavailable = true;
          }
        }
        return {
          centralId,
          connectionState: core.connectionState,
          deviceCount: core.devices.size,
          ...(information?.serviceMessageCount === undefined
            ? {}
            : { serviceMessageCount: information.serviceMessageCount }),
          ...(information?.dutyCycle === undefined
            ? {}
            : { dutyCycle: information.dutyCycle }),
          ...(information?.carrierSense === undefined
            ? {}
            : { carrierSense: information.carrierSense }),
          radioInterfaces:
            information?.radioInterfaces.map(
              ({ name, type, dutyCycle, carrierSense }) => ({
                ...(name === undefined ? {} : { name }),
                ...(type === undefined ? {} : { type }),
                ...(dutyCycle === undefined ? {} : { dutyCycle }),
                ...(carrierSense === undefined ? {} : { carrierSense }),
              }),
            ) ?? [],
          ...(partial ? { partial: true as const } : {}),
          ...(unavailable ? { unavailable: true as const } : {}),
        } satisfies CentralSystemStatusView;
      }),
    );
    return { refreshedAt: new Date().toISOString(), centrals };
  }

  #requireRuntime(centralId: string): OpenCcuRuntime {
    const runtime = this.get(centralId);
    if (runtime === undefined) {
      throw new Error(`OpenCCU central ${centralId} is not connected`);
    }
    return runtime;
  }
}

function matchesQuery(name: string, query: string): boolean {
  return name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

function encodeHubId(centralId: string, objectId: string): string {
  return JSON.stringify([centralId, objectId]);
}

function parseHubOption(option: unknown): {
  readonly centralId: string;
  readonly objectId: string;
} {
  if (typeof option !== "object" || option === null || !("id" in option)) {
    throw new TypeError("Invalid OpenCCU Flow selection");
  }
  const encoded = (option as { readonly id?: unknown }).id;
  if (typeof encoded !== "string") {
    throw new TypeError("Invalid OpenCCU Flow selection ID");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch {
    throw new TypeError("Invalid OpenCCU Flow selection ID");
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) {
    throw new TypeError("Invalid OpenCCU Flow selection ID");
  }
  const centralId: unknown = parsed[0];
  const objectId: unknown = parsed[1];
  if (
    typeof centralId !== "string" ||
    centralId === "" ||
    typeof objectId !== "string" ||
    objectId === ""
  ) {
    throw new TypeError("Invalid OpenCCU Flow selection ID");
  }
  return { centralId, objectId };
}
