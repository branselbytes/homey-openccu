import { ProtocolError } from "./errors";

export type ConnectionState = "connecting" | "disconnected" | "healthy" | "stopped";

export interface ConnectionSupervisorOptions {
  readonly connect: (signal: AbortSignal) => Promise<void>;
  readonly disconnect?: () => void | Promise<void>;
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly onStateChange?: (state: ConnectionState, error?: unknown) => void;
  readonly wait?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
}

export class ConnectionSupervisor {
  readonly #options: ConnectionSupervisorOptions;
  #controller?: AbortController;
  #run?: Promise<void>;
  #state: ConnectionState = "stopped";

  constructor(options: ConnectionSupervisorOptions) {
    this.#options = options;
  }

  get state(): ConnectionState {
    return this.#state;
  }

  start(): void {
    if (this.#run) return;
    this.#controller = new AbortController();
    this.#run = this.#runLoop(this.#controller.signal);
  }

  async stop(): Promise<void> {
    this.#controller?.abort();
    await this.#run;
    await this.#options.disconnect?.();
    this.#run = undefined;
    this.#controller = undefined;
    this.#setState("stopped");
  }

  async #runLoop(signal: AbortSignal): Promise<void> {
    let delay = this.#options.initialDelayMs ?? 1_000;
    const maximum = this.#options.maxDelayMs ?? 60_000;
    while (!signal.aborted) {
      this.#setState("connecting");
      try {
        await this.#options.connect(signal);
        this.#setState("healthy");
        return;
      } catch (error) {
        if (signal.aborted) return;
        this.#setState("disconnected", error);
        await (this.#options.wait ?? wait)(delay, signal).catch(() => undefined);
        delay = Math.min(delay * 2, maximum);
      }
    }
  }

  #setState(state: ConnectionState, error?: unknown): void {
    if (this.#state === state && error === undefined) return;
    this.#state = state;
    this.#options.onStateChange?.(state, error);
  }
}

async function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new ProtocolError("aborted", "Connection retry wait was aborted"));
      },
      { once: true },
    );
  });
}
