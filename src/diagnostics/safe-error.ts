import { ProtocolError, isXmlRpcFaultCode } from "../protocol/errors";

const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u;

/** Returns only a bounded error class, never its message, stack or properties. */
export function safeErrorKind(error: unknown): string {
  if (error instanceof Error && SAFE_ERROR_NAME.test(error.name)) {
    return error.name;
  }
  return "Error";
}

/** Fixed protocol categories and numeric fault codes only; never raw messages. */
export function safeErrorSummary(error: unknown): string {
  if (!(error instanceof ProtocolError)) return safeErrorKind(error);
  const code: unknown = Object.getOwnPropertyDescriptor(error, "code")?.value;
  const allowed: readonly unknown[] = [
    "aborted",
    "authentication",
    "invalid-response",
    "not-connected",
    "remote-fault",
    "timeout",
    "transport",
  ];
  if (!allowed.includes(code)) return "ProtocolError";
  const fault: unknown = Object.getOwnPropertyDescriptor(
    error,
    "faultCode",
  )?.value;
  return (
    `ProtocolError code=${String(code)}` +
    (code === "remote-fault" && isXmlRpcFaultCode(fault)
      ? ` faultCode=${fault}`
      : "")
  );
}
