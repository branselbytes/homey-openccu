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

  constructor(code: ProtocolErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ProtocolError";
    this.code = code;
    this.cause = cause;
  }
}

export function toProtocolError(error: unknown, context: string): ProtocolError {
  if (error instanceof ProtocolError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new ProtocolError("aborted", `${context} was aborted`, error);
  }
  return new ProtocolError("transport", `${context} failed`, error);
}
