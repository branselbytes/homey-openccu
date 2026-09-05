import type {
  OpenCcuMetadata,
  OpenCcuProgram,
  OpenCcuSystemVariable,
} from "../../domain/model";
import type { RpcValue } from "../xmlrpc/types";

export interface JsonRpcSession {
  call(
    method: string,
    params?: Readonly<Record<string, unknown>>,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

export interface MetadataIssue {
  readonly method: string;
  readonly message: string;
}

export interface OpenCcuMetadataResult {
  readonly metadata: OpenCcuMetadata;
  readonly issues: readonly MetadataIssue[];
}

interface RawChannel {
  readonly address?: unknown;
  readonly name?: unknown;
}

interface RawDevice {
  readonly address?: unknown;
  readonly name?: unknown;
  readonly channels?: unknown;
}

interface RawGroup {
  readonly name?: unknown;
  readonly channelIds?: unknown;
}

interface RawProgram {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly isActive?: unknown;
}

interface RawSystemVariable {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly type?: unknown;
  readonly value?: unknown;
}

const METHODS = {
  devices: "Device.listAllDetail",
  rooms: "Room.getAll",
  functions: "Subsection.getAll",
  programs: "Program.getAll",
  systemVariables: "SysVar.getAll",
} as const;

export async function loadOpenCcuMetadata(
  session: JsonRpcSession,
  signal?: AbortSignal,
): Promise<OpenCcuMetadataResult> {
  const entries = await Promise.all(
    Object.entries(METHODS).map(async ([key, method]) => {
      try {
        return [key, await session.call(method, {}, signal)] as const;
      } catch (error) {
        return [
          key,
          { issue: { method, message: safeErrorMessage(error) } },
        ] as const;
      }
    }),
  );
  const results = Object.fromEntries(entries) as Record<
    keyof typeof METHODS,
    unknown
  >;
  const issues = Object.values(results)
    .filter(isIssueResult)
    .map(({ issue }) => issue);

  return {
    metadata: {
      names: parseNames(unwrap(results.devices)),
      rooms: parseGroups(unwrap(results.rooms)),
      functions: parseGroups(unwrap(results.functions)),
      programs: parsePrograms(unwrap(results.programs)),
      systemVariables: parseSystemVariables(unwrap(results.systemVariables)),
    },
    issues,
  };
}

function parseNames(value: unknown): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const device of arrayOf<RawDevice>(value)) {
    addName(names, device.address, device.name);
    for (const channel of arrayOf<RawChannel>(device.channels)) {
      addName(names, channel.address, channel.name);
    }
  }
  return names;
}

function addName(
  names: Map<string, string>,
  address: unknown,
  name: unknown,
): void {
  if (
    typeof address === "string" &&
    address !== "" &&
    typeof name === "string" &&
    name.trim() !== ""
  ) {
    names.set(address, name.trim());
  }
}

function parseGroups(value: unknown): ReadonlyMap<string, readonly string[]> {
  const groups = new Map<string, readonly string[]>();
  for (const group of arrayOf<RawGroup>(value)) {
    if (typeof group.name !== "string" || group.name.trim() === "") continue;
    groups.set(
      group.name.trim(),
      arrayOf<unknown>(group.channelIds).filter(
        (id): id is string => typeof id === "string" && id !== "",
      ),
    );
  }
  return groups;
}

function parsePrograms(value: unknown): readonly OpenCcuProgram[] {
  return arrayOf<RawProgram>(value).flatMap((program) =>
    typeof program.id === "string" &&
    typeof program.name === "string" &&
    typeof program.isActive === "boolean"
      ? [{ id: program.id, name: program.name, active: program.isActive }]
      : [],
  );
}

function parseSystemVariables(
  value: unknown,
): readonly OpenCcuSystemVariable[] {
  return arrayOf<RawSystemVariable>(value).flatMap((variable) => {
    if (typeof variable.id !== "string" || typeof variable.name !== "string") {
      return [];
    }
    return [
      {
        id: variable.id,
        name: variable.name,
        value: parseSystemVariableValue(variable.type, variable.value),
      },
    ];
  });
}

function parseSystemVariableValue(type: unknown, value: unknown): RpcValue {
  if (typeof value !== "string") return toRpcValue(value);
  if (type === "NUMBER") {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (type === "ALARM" || type === "LOGIC") {
    if (value === "1" || value.toLowerCase() === "true") return true;
    if (value === "0" || value.toLowerCase() === "false") return false;
  }
  return value;
}

function toRpcValue(value: unknown): RpcValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  return String(value);
}

function arrayOf<T>(value: unknown): readonly T[] {
  return Array.isArray(value) ? (value as readonly T[]) : [];
}

function isIssueResult(
  value: unknown,
): value is { readonly issue: MetadataIssue } {
  return typeof value === "object" && value !== null && "issue" in value;
}

function unwrap(value: unknown): unknown {
  return isIssueResult(value) ? [] : value;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message !== ""
    ? error.message
    : "unknown JSON-RPC error";
}
