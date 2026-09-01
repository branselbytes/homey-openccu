const SENSITIVE_KEY = /authorization|cookie|credential|password|secret|session|token/i;
const ADDRESS_KEY = /^(host|hostname|ip|url)$/i;

export interface RedactionOptions {
  readonly includeAddresses?: boolean;
  readonly includeValues?: boolean;
}

export function redactDiagnosticValue(value: unknown, options: RedactionOptions = {}): unknown {
  return redact(value, options, new WeakSet());
}

function redact(value: unknown, options: RedactionOptions, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => redact(entry, options, seen));
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) result[key] = "[Redacted]";
    else if (!options.includeAddresses && ADDRESS_KEY.test(key)) result[key] = "[Address Redacted]";
    else if (!options.includeValues && key.toLowerCase() === "value") result[key] = "[Value Redacted]";
    else result[key] = redact(entry, options, seen);
  }
  return result;
}
