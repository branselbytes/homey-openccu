import { isXmlRpcFaultCode, type ProtocolErrorCode } from "../errors";
import type { XmlRpcErrorDiagnostics, XmlRpcMethod } from "./types";

const SAFE_METHODS: readonly XmlRpcMethod[] = [
  "listDevices",
  "getParamsetDescription",
  "getValue",
  "getParamset",
  "setValue",
  "putParamset",
  "init",
];
const SAFE_CODES: readonly ProtocolErrorCode[] = [
  "aborted",
  "authentication",
  "invalid-response",
  "not-connected",
  "remote-fault",
  "timeout",
  "transport",
];

/** Projects only bounded protocol facts, never error text, causes or parameters. */
export function sanitizeXmlRpcErrorDiagnostics(
  value: unknown,
): XmlRpcErrorDiagnostics | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  if (
    !SAFE_METHODS.includes(raw.method as XmlRpcMethod) ||
    !SAFE_CODES.includes(raw.code as ProtocolErrorCode)
  )
    return undefined;
  return {
    method: raw.method as XmlRpcMethod,
    code: raw.code as ProtocolErrorCode,
    ...(raw.code === "remote-fault" && isXmlRpcFaultCode(raw.faultCode)
      ? { faultCode: raw.faultCode }
      : {}),
  };
}
