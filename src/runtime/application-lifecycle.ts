import type { OpenCcuConnectionConfig } from "../config/openccu-config";
import { loadOpenCcuConnections, type SettingsReader } from "../homey/settings-adapter";
import { RuntimeRegistry, type ManagedRuntime } from "./runtime-registry";

export interface RuntimeFactory<Runtime extends ManagedRuntime> {
  create(config: OpenCcuConnectionConfig): Promise<Runtime>;
}

export class OpenCcuApplicationLifecycle<Runtime extends ManagedRuntime> {
  readonly #settings: SettingsReader;
  readonly #factory: RuntimeFactory<Runtime>;
  readonly #registry: RuntimeRegistry<Runtime>;
  readonly #configuredCentralIds = new Set<string>();
  #operation: Promise<void> = Promise.resolve();

  constructor(
    settings: SettingsReader,
    factory: RuntimeFactory<Runtime>,
    registry = new RuntimeRegistry<Runtime>(),
  ) {
    this.#settings = settings;
    this.#factory = factory;
    this.#registry = registry;
  }

  get runtimeCount(): number {
    return this.#registry.size;
  }

  getRuntime(centralId: string): Runtime | undefined {
    return this.#registry.get(centralId);
  }

  runtimeEntries(): readonly (readonly [string, Runtime])[] {
    return this.#registry.entries();
  }

  start(): Promise<void> {
    return this.reload();
  }

  reload(): Promise<void> {
    return this.#enqueue(() => this.#reload());
  }

  stop(): Promise<void> {
    return this.#enqueue(async () => {
      this.#configuredCentralIds.clear();
      await this.#registry.stopAll();
    });
  }

  #enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.#operation.then(operation, operation);
    this.#operation = result.catch(() => undefined);
    return result;
  }

  async #reload(): Promise<void> {
    const configs = loadOpenCcuConnections(this.#settings);
    const nextIds = new Set(configs.map((config) => config.centralId));

    for (const config of configs) {
      const runtime = await this.#factory.create(config);
      try {
        await this.#registry.replace(config.centralId, runtime);
      } catch (error) {
        await Promise.resolve()
          .then(() => runtime.stop())
          .catch(() => undefined);
        throw error;
      }
    }

    for (const centralId of this.#configuredCentralIds) {
      if (!nextIds.has(centralId)) await this.#registry.remove(centralId);
    }
    this.#configuredCentralIds.clear();
    for (const centralId of nextIds) this.#configuredCentralIds.add(centralId);
  }
}
