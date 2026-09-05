import type { OpenCcuRuntimeDiagnostics } from "../runtime/openccu-runtime";
import { redactDiagnosticValue } from "./redact";

export const SUPPORT_REPORT_SCHEMA_VERSION = 1;

export interface SupportReportRuntime {
  readonly centralId: string;
  readonly runtime: OpenCcuRuntimeDiagnostics;
}

export interface SupportReportInput {
  readonly app: {
    readonly id: string;
    readonly version: string;
    readonly node: string;
  };
  readonly runtimes: readonly SupportReportRuntime[];
}

export interface SupportReport {
  readonly schemaVersion: typeof SUPPORT_REPORT_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly app: SupportReportInput["app"];
  readonly centrals: readonly {
    readonly alias: string;
    readonly runtime: OpenCcuRuntimeDiagnostics;
  }[];
}

/**
 * Produces a support report containing only aggregate runtime facts. Central
 * identifiers, addresses, names, datapoint values and credentials are omitted.
 */
export function createSupportReport(
  input: SupportReportInput,
  generatedAt = new Date(),
): SupportReport {
  const report = {
    schemaVersion: SUPPORT_REPORT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    app: input.app,
    centrals: input.runtimes.map(({ runtime }, index) => ({
      alias: `central-${index + 1}`,
      runtime,
    })),
  };

  // Keep redaction as a final defence if future runtime diagnostics gain a
  // sensitive field. Addresses and values remain excluded by default.
  return redactDiagnosticValue(report) as SupportReport;
}
