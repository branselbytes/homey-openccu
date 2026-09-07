const SAFE_ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u;

/** Returns only a bounded error class, never its message, stack or properties. */
export function safeErrorKind(error: unknown): string {
  if (error instanceof Error && SAFE_ERROR_NAME.test(error.name)) {
    return error.name;
  }
  return "Error";
}
