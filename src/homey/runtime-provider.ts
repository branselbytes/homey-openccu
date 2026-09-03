import type { PairingCandidate } from "../pairing/candidates";
import type { ManagedCentralRuntime } from "../runtime/managed-central-runtime";
import type { OpenCcuRuntime } from "../runtime/openccu-runtime";
import type { OpenCcuRuntimeDiagnostics } from "../runtime/openccu-runtime";

export interface ManagedRuntimeSource {
  getRuntime(centralId: string): ManagedCentralRuntime | undefined;
  runtimeEntries(): readonly (readonly [string, ManagedCentralRuntime])[];
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
}
