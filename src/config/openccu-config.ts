import { DEFAULT_HMIP_RF_XML_RPC_PORT } from "../protocol/xmlrpc/homematic-adapter";

export const DEFAULT_JSON_RPC_PATH = "/api/homematic.cgi";
export const DEFAULT_XML_RPC_CALLBACK_PORT = 12010;
export const DEFAULT_VIRTUAL_DEVICES_XML_RPC_PORT = 9292;

export interface OpenCcuConnectionConfig {
  readonly centralId: string;
  readonly host: string;
  readonly hmIpRfPort: number;
  readonly virtualDevicesPort: number;
  readonly callbackPort: number;
  readonly virtualDevicesCallbackPort: number;
  readonly jsonRpcUrl: string;
  readonly username?: string;
  readonly password?: string;
}

export interface OpenCcuSettingsInput {
  readonly centralId?: unknown;
  readonly host?: unknown;
  readonly hmIpRfPort?: unknown;
  readonly virtualDevicesPort?: unknown;
  readonly callbackPort?: unknown;
  readonly virtualDevicesCallbackPort?: unknown;
  readonly username?: unknown;
  readonly password?: unknown;
}

export function parseOpenCcuSettings(input: OpenCcuSettingsInput): OpenCcuConnectionConfig {
  const centralId = requiredText(input.centralId, "centralId");
  const host = parseHost(requiredText(input.host, "host"));
  const hmIpRfPort = parsePort(input.hmIpRfPort ?? DEFAULT_HMIP_RF_XML_RPC_PORT);
  const virtualDevicesPort = parsePort(
    input.virtualDevicesPort ?? DEFAULT_VIRTUAL_DEVICES_XML_RPC_PORT,
    "VirtualDevices",
  );
  const callbackPort = parsePort(input.callbackPort ?? DEFAULT_XML_RPC_CALLBACK_PORT, "callback");
  const virtualDevicesCallbackPort = parsePort(
    input.virtualDevicesCallbackPort ?? callbackPort + 1,
    "VirtualDevices callback",
  );
  if (callbackPort === virtualDevicesCallbackPort) {
    throw new Error("OpenCCU callback ports must be different");
  }
  const username = optionalText(input.username);
  const password = optionalText(input.password);
  if ((username === undefined) !== (password === undefined)) {
    throw new Error("OpenCCU username and password must be configured together");
  }

  return {
    centralId,
    host,
    hmIpRfPort,
    virtualDevicesPort,
    callbackPort,
    virtualDevicesCallbackPort,
    jsonRpcUrl: new URL(DEFAULT_JSON_RPC_PATH, `http://${formatUrlHost(host)}`).toString(),
    ...(username === undefined ? {} : { username, password }),
  };
}

/** Returns only fields that are safe to include in diagnostics. */
export function publicOpenCcuConfig(config: OpenCcuConnectionConfig): Omit<
  OpenCcuConnectionConfig,
  "username" | "password"
> & { readonly authenticated: boolean } {
  return {
    centralId: config.centralId,
    host: config.host,
    hmIpRfPort: config.hmIpRfPort,
    virtualDevicesPort: config.virtualDevicesPort,
    callbackPort: config.callbackPort,
    virtualDevicesCallbackPort: config.virtualDevicesCallbackPort,
    jsonRpcUrl: config.jsonRpcUrl,
    authenticated: config.username !== undefined,
  };
}

function requiredText(value: unknown, field: string): string {
  const result = optionalText(value);
  if (result === undefined) throw new Error(`OpenCCU ${field} is required`);
  return result;
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new TypeError("OpenCCU text settings must be strings");
  const result = value.trim();
  return result.length === 0 ? undefined : result;
}

function parseHost(value: string): string {
  if (value.includes("://") || /[/?#]/u.test(value)) {
    throw new Error("OpenCCU host must not contain a protocol, path, query, or fragment");
  }
  if (/\s/u.test(value)) throw new Error("OpenCCU host must not contain whitespace");
  if (value.startsWith("[") && value.endsWith("]")) return value.slice(1, -1);
  return value;
}

function parsePort(value: unknown, name = "HmIP-RF"): number {
  const port = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65_535) {
    throw new RangeError(`OpenCCU ${name} port must be an integer between 1 and 65535`);
  }
  return port as number;
}

function formatUrlHost(host: string): string {
  return host.includes(":") ? `[${host}]` : host;
}
