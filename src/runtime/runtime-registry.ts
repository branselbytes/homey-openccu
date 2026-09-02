export interface ManagedRuntime {
  stop(): void | Promise<void>;
}

export class RuntimeRegistry<Runtime extends ManagedRuntime> {
  readonly #runtimes = new Map<string, Runtime>();

  get size(): number {
    return this.#runtimes.size;
  }

  get(centralId: string): Runtime | undefined {
    return this.#runtimes.get(centralId);
  }

  entries(): readonly (readonly [string, Runtime])[] {
    return [...this.#runtimes.entries()];
  }

  async replace(centralId: string, runtime: Runtime): Promise<void> {
    const previous = this.#runtimes.get(centralId);
    if (previous === runtime) return;
    if (previous) await previous.stop();
    this.#runtimes.set(centralId, runtime);
  }

  async remove(centralId: string): Promise<boolean> {
    const runtime = this.#runtimes.get(centralId);
    if (!runtime) return false;
    this.#runtimes.delete(centralId);
    await runtime.stop();
    return true;
  }

  async stopAll(): Promise<void> {
    const runtimes = [...this.#runtimes.values()];
    this.#runtimes.clear();
    const results = await Promise.allSettled(
      runtimes.map((runtime) => Promise.resolve().then(() => runtime.stop())),
    );
    const errors = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => result.reason as unknown);
    if (errors.length > 0) throw new AggregateError(errors, "Failed to stop OpenCCU runtimes");
  }
}
