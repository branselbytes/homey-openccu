import type { MappingDecision } from "../mapping/decision";
import type { ConnectionState } from "../protocol/connection-supervisor";
import { redactDiagnosticValue, type RedactionOptions } from "./redact";

export interface DiagnosticConnection {
  readonly interfaceId: string;
  readonly state: ConnectionState;
  readonly lastError?: string;
}

export interface DiagnosticSnapshotInput {
  readonly app: { readonly id: string; readonly version: string; readonly node: string };
  readonly central: unknown;
  readonly connections: readonly DiagnosticConnection[];
  readonly mappings: readonly MappingDecision[];
  readonly recentEvents?: readonly unknown[];
}

export interface DiagnosticSnapshot {
  readonly generatedAt: string;
  readonly app: DiagnosticSnapshotInput["app"];
  readonly central: unknown;
  readonly connections: readonly DiagnosticConnection[];
  readonly mappings: readonly MappingDecision[];
  readonly recentEvents: readonly unknown[];
}

export function createDiagnosticSnapshot(
  input: DiagnosticSnapshotInput,
  options: RedactionOptions = {},
): DiagnosticSnapshot {
  return redactDiagnosticValue(
    {
      generatedAt: new Date().toISOString(),
      app: input.app,
      central: input.central,
      connections: input.connections,
      mappings: input.mappings,
      recentEvents: input.recentEvents ?? [],
    },
    options,
  ) as DiagnosticSnapshot;
}
