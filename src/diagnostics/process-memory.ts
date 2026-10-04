const MEMORY_FIELDS = [
  "rss",
  "heapTotal",
  "heapUsed",
  "external",
  "arrayBuffers",
] as const;

type MemoryField = (typeof MEMORY_FIELDS)[number];

export interface ProcessMemoryWarning {
  readonly uptimeSeconds?: number;
  /** Numeric count supplied by the latest Homey memwarn event, if present. */
  readonly count?: number;
  /** Numeric limit supplied by Homey; its unit is not inferred here. */
  readonly limit?: number;
}

export interface ProcessMemorySnapshot {
  readonly rss?: number;
  readonly heapTotal?: number;
  readonly heapUsed?: number;
  readonly external?: number;
  readonly arrayBuffers?: number;
  readonly uptimeSeconds?: number;
  /** Number of warning notifications observed by this diagnostics instance. */
  readonly warningCount: number;
  readonly lastWarning?: ProcessMemoryWarning;
}

export interface ProcessMemoryDiagnosticsOptions {
  /** Samples only this Node.js process. Unknown input is filtered by allowlist. */
  readonly sampler?: () => unknown;
  /** Process uptime in seconds, not a wall-clock timestamp. */
  readonly clock?: () => number;
}

/**
 * Constant-size process diagnostics. Retains no raw event, exception, environment
 * or sample; only the latest warning's allowed numeric facts are stored.
 */
export class ProcessMemoryDiagnostics {
  private readonly sampler: () => unknown;
  private readonly clock: () => number;
  private warningCount = 0;
  private lastWarning?: ProcessMemoryWarning;

  constructor(options: ProcessMemoryDiagnosticsOptions = {}) {
    this.sampler = options.sampler ?? (() => process.memoryUsage());
    this.clock = options.clock ?? (() => process.uptime());
  }

  onWarning(warning: unknown): void {
    this.warningCount = Math.min(
      Number.MAX_SAFE_INTEGER,
      this.warningCount + 1,
    );
    const uptimeSeconds = this.uptime();
    const count = ownNumber(warning, "count", true);
    const limit = ownNumber(warning, "limit");
    this.lastWarning = {
      ...(uptimeSeconds === undefined ? {} : { uptimeSeconds }),
      ...(count === undefined ? {} : { count }),
      ...(limit === undefined ? {} : { limit }),
    };
  }

  snapshot(): ProcessMemorySnapshot {
    const memory: Partial<Record<MemoryField, number>> = {};
    let sample: unknown;
    try {
      sample = this.sampler();
    } catch {
      // Diagnostics must remain usable when a sampler is unavailable. Never
      // retain or include an exception, which may contain private runtime data.
    }
    for (const field of MEMORY_FIELDS) {
      const value = ownNumber(sample, field, true);
      if (value !== undefined) memory[field] = value;
    }
    const uptimeSeconds = this.uptime();
    return {
      ...memory,
      ...(uptimeSeconds === undefined ? {} : { uptimeSeconds }),
      warningCount: this.warningCount,
      ...(this.lastWarning === undefined
        ? {}
        : { lastWarning: { ...this.lastWarning } }),
    };
  }

  private uptime(): number | undefined {
    try {
      return finiteNonNegative(this.clock());
    } catch {
      return undefined;
    }
  }
}

function finiteNonNegative(
  value: unknown,
  integer = false,
): number | undefined {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER ||
    (integer && !Number.isInteger(value))
  ) {
    return undefined;
  }
  return value;
}

function ownNumber(
  input: unknown,
  key: string,
  integer = false,
): number | undefined {
  if (typeof input !== "object" || input === null) {
    return undefined;
  }
  try {
    if (Array.isArray(input)) return undefined;
    // Accessor properties are ignored: collecting diagnostics must not execute
    // arbitrary payload getters or accidentally stringify private objects.
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return descriptor && "value" in descriptor
      ? finiteNonNegative(descriptor.value, integer)
      : undefined;
  } catch {
    return undefined;
  }
}
