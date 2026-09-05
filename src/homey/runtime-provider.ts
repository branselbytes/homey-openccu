import type { PairingCandidate } from "../pairing/candidates";
import type { ManagedCentralRuntime } from "../runtime/managed-central-runtime";
import type { OpenCcuRuntime } from "../runtime/openccu-runtime";
import type { OpenCcuRuntimeDiagnostics } from "../runtime/openccu-runtime";

export interface ManagedRuntimeSource {
  getRuntime(centralId: string): ManagedCentralRuntime | undefined;
  runtimeEntries(): readonly (readonly [string, ManagedCentralRuntime])[];
}

export interface HubFlowOption {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export class OpenCcuRuntimeProvider {
  readonly #source: ManagedRuntimeSource;

  constructor(source: ManagedRuntimeSource) {
    this.#source = source;
  }

  get(centralId: string): OpenCcuRuntime | undefined {
    return this.#source.getRuntime(centralId)?.core;
  }

  pairingCandidates(driverId: string): readonly PairingCandidate[] {
    return this.#source
      .runtimeEntries()
      .flatMap(([, runtime]) => runtime.core.pairingCandidates())
      .filter((candidate) => candidate.driverId === driverId);
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
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2
  ) {
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
