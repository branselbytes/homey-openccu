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
  readonly id?: unknown;
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
  readonly isInternal?: unknown;
}

interface RawSystemVariable {
  readonly id?: unknown;
  readonly name?: unknown;
  readonly type?: unknown;
  readonly value?: unknown;
  readonly isVisible?: unknown;
  readonly isInternal?: unknown;
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
  const issues: MetadataIssue[] = [];
  const load = async <Result>(
    method: string,
    parse: (value: unknown) => Result,
    fallback: Result,
  ): Promise<Result> => {
    try {
      return parse(await session.call(method, {}, signal));
    } catch (error) {
      issues.push({ method, message: safeErrorMessage(error) });
      return fallback;
    }
  };

  const devices = await load(METHODS.devices, parseDevices, {
    names: new Map<string, string>(),
    channelAddressesById: new Map<string, string>(),
  });
  const rooms = await load<ReadonlyMap<string, readonly string[]>>(
    METHODS.rooms,
    (value) => parseGroups(value, devices.channelAddressesById),
    new Map(),
  );
  const functions = await load<ReadonlyMap<string, readonly string[]>>(
    METHODS.functions,
    (value) => parseGroups(value, devices.channelAddressesById),
    new Map(),
  );
  const programs = await load(METHODS.programs, parsePrograms, []);
  const systemVariables = await load(
    METHODS.systemVariables,
    parseSystemVariables,
    [],
  );

  return {
    metadata: {
      names: devices.names,
      rooms,
      functions,
      programs,
      systemVariables,
    },
    issues,
  };
}

function parseDevices(value: unknown): {
  readonly names: ReadonlyMap<string, string>;
  readonly channelAddressesById: ReadonlyMap<string, string>;
} {
  const names = new Map<string, string>();
  const channelAddressesById = new Map<string, string>();
  for (const device of arrayOf<RawDevice>(value)) {
    addName(names, device.address, device.name);
    for (const channel of arrayOf<RawChannel>(device.channels)) {
      addName(names, channel.address, channel.name);
      const id = identifier(channel.id);
      if (id !== undefined && typeof channel.address === "string") {
        channelAddressesById.set(id, channel.address);
      }
    }
  }
  return { names, channelAddressesById };
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

function parseGroups(
  value: unknown,
  channelAddressesById: ReadonlyMap<string, string>,
): ReadonlyMap<string, readonly string[]> {
  const groups = new Map<string, readonly string[]>();
  for (const group of arrayOf<RawGroup>(value)) {
    if (typeof group.name !== "string" || group.name.trim() === "") continue;
    groups.set(
      group.name.trim(),
      arrayOf<unknown>(group.channelIds).flatMap((rawId) => {
        const id = identifier(rawId);
        if (id === undefined) return [];
        const address = channelAddressesById.get(id);
        if (address !== undefined) return [address];
        return id.includes(":") ? [id] : [];
      }),
    );
  }
  return groups;
}

function identifier(value: unknown): string | undefined {
  if (typeof value === "string" && value !== "") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function parsePrograms(value: unknown): readonly OpenCcuProgram[] {
  return arrayOf<RawProgram>(value).flatMap((program) =>
    typeof program.id === "string" &&
    typeof program.name === "string" &&
    typeof program.isActive === "boolean" &&
    program.isInternal !== true
      ? [{ id: program.id, name: program.name, active: program.isActive }]
      : [],
  );
}

function parseSystemVariables(
  value: unknown,
): readonly OpenCcuSystemVariable[] {
  return arrayOf<RawSystemVariable>(value).flatMap((variable) => {
    if (
      typeof variable.id !== "string" ||
      typeof variable.name !== "string" ||
      variable.isInternal === true ||
      variable.isVisible === false
    ) {
      return [];
    }
    return [
      {
        id: variable.id,
        name: variable.name,
        type: typeof variable.type === "string" ? variable.type : "UNKNOWN",
        value: parseSystemVariableValue(variable.type, variable.value),
      },
    ];
  });
}

export async function executeOpenCcuProgram(
  session: JsonRpcSession,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  const result = await session.call("Program.execute", { id }, signal);
  if (result === false) {
    throw new Error(`OpenCCU did not execute program ${id}`);
  }
}

export async function setOpenCcuSystemVariable(
  session: JsonRpcSession,
  id: string,
  value: RpcValue,
  signal?: AbortSignal,
): Promise<void> {
  const result = await session.call("SysVar.setValue", { id, value }, signal);
  if (result === false) {
    throw new Error(`OpenCCU did not update system variable ${id}`);
  }
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
  if (typeof value === "bigint") return value.toString();
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value) ?? "unsupported JSON-RPC value";
  } catch {
    return "unsupported JSON-RPC value";
  }
}

function arrayOf<T>(value: unknown): readonly T[] {
  return Array.isArray(value) ? (value as readonly T[]) : [];
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error && error.message !== ""
    ? error.message
    : "unknown JSON-RPC error";
}
