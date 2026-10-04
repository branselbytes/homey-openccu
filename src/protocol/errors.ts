export type ProtocolErrorCode =
  | "aborted"
  | "authentication"
  | "invalid-response"
  | "not-connected"
  | "remote-fault"
  | "timeout"
  | "transport";

export class ProtocolError extends Error {
  readonly code: ProtocolErrorCode;
  readonly cause?: unknown;
  readonly faultCode?: number;

  constructor(
    code: ProtocolErrorCode,
    message: string,
    cause?: unknown,
    faultCode?: number,
  ) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    this.cause = cause;
    if (isXmlRpcFaultCode(faultCode)) this.faultCode = faultCode;
  }
}

export function toProtocolError(
  error: unknown,
  context: string,
): ProtocolError {
  if (error instanceof ProtocolError) return error;
  const faultCode = getXmlRpcFaultCode(error);
  if (faultCode !== undefined) {
    // faultString and the original error may contain addresses or credentials.
    return new ProtocolError(
      "remote-fault",
      `${context} failed (CCU fault code ${faultCode})`,
      undefined,
      faultCode,
    );
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new ProtocolError("aborted", `${context} was aborted`, error);
  }
  return new ProtocolError("transport", `${context} failed`, error);
}

/** XML-RPC fault codes are signed 32-bit integers; zero is a valid code. */
export function isXmlRpcFaultCode(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= -2_147_483_648 &&
    value <= 2_147_483_647
  );
}

function getXmlRpcFaultCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  try {
    // Do not invoke accessors or interpret an arbitrary error message as a code.
    const value: unknown = Object.getOwnPropertyDescriptor(
      error,
      "faultCode",
    )?.value;
    return isXmlRpcFaultCode(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
