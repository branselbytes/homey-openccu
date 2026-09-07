import type { JsonRpcSession, MetadataIssue } from "./metadata";

export interface OpenCcuRadioInterfaceStatus {
  readonly address: string;
  readonly name?: string;
  readonly type?: string;
  readonly dutyCycle?: number;
  readonly carrierSense?: number;
}

export interface OpenCcuSystemInformation {
  readonly serviceMessageCount?: number;
  readonly dutyCycle?: number;
  readonly carrierSense?: number;
  readonly radioInterfaces: readonly OpenCcuRadioInterfaceStatus[];
}

export interface OpenCcuSystemInformationResult {
  readonly information: OpenCcuSystemInformation;
  readonly issues: readonly MetadataIssue[];
}

const METHODS = {
  dutyCycle: "Interface.getDutyCycle",
  serviceMessageCount: "Interface.getServiceMessageCount",
} as const;

export async function loadOpenCcuSystemInformation(
  session: JsonRpcSession,
  interfaceId: string,
  signal?: AbortSignal,
): Promise<OpenCcuSystemInformationResult> {
  const issues: MetadataIssue[] = [];
  const [radioInterfaces, serviceMessageCount] = await Promise.all([
    loadOptional(
      session,
      METHODS.dutyCycle,
      {},
      parseRadioInterfaces,
      [],
      issues,
      signal,
    ),
    loadOptional(
      session,
      METHODS.serviceMessageCount,
      { interface: interfaceId },
      parseServiceMessageCount,
      undefined,
      issues,
      signal,
    ),
  ]);

  return {
    information: {
      serviceMessageCount,
      dutyCycle: maximumMetric(radioInterfaces, "dutyCycle"),
      carrierSense: maximumMetric(radioInterfaces, "carrierSense"),
      radioInterfaces,
    },
    issues,
  };
}

async function loadOptional<Result>(
  session: JsonRpcSession,
  method: string,
  params: Readonly<Record<string, unknown>>,
  parse: (value: unknown) => Result,
  fallback: Result,
  issues: MetadataIssue[],
  signal?: AbortSignal,
): Promise<Result> {
  try {
    return parse(await session.call(method, params, signal));
  } catch (error) {
    issues.push({ method, message: safeErrorMessage(error) });
    return fallback;
  }
}

function parseRadioInterfaces(
  value: unknown,
): readonly OpenCcuRadioInterfaceStatus[] {
  if (!Array.isArray(value)) {
    throw new TypeError("OpenCCU duty-cycle response is not an array");
  }
  return value.flatMap((entry): readonly OpenCcuRadioInterfaceStatus[] => {
    if (!isRecord(entry) || typeof entry.address !== "string") return [];
    const name = text(entry.name);
    const type = text(entry.type);
    const dutyCycle = percentage(entry.dutyCycle);
    const carrierSense = percentage(entry.carrierSense);
    return [
      {
        address: entry.address,
        ...(name === undefined ? {} : { name }),
        ...(type === undefined ? {} : { type }),
        ...(dutyCycle === undefined ? {} : { dutyCycle }),
        ...(carrierSense === undefined ? {} : { carrierSense }),
      },
    ];
  });
}

function parseServiceMessageCount(value: unknown): number {
  const count = typeof value === "string" ? Number(value) : value;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new TypeError("OpenCCU service-message count is invalid");
  }
  return count;
}

function maximumMetric(
  interfaces: readonly OpenCcuRadioInterfaceStatus[],
  key: "dutyCycle" | "carrierSense",
): number | undefined {
  const values = interfaces.flatMap((entry) =>
    entry[key] === undefined ? [] : [entry[key]],
  );
  return values.length === 0 ? undefined : Math.max(...values);
}

function percentage(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" &&
    Number.isFinite(parsed) &&
    parsed >= 0 &&
    parsed <= 100
    ? parsed
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message !== ""
    ? error.message
    : "unknown JSON-RPC error";
}
