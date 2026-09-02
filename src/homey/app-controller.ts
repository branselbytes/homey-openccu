import { OPENCCU_CONNECTIONS_SETTING } from "./settings-adapter";

export interface SettingsEvents {
  on(event: "set" | "unset", listener: (key: string) => void): unknown;
  removeListener(event: "set" | "unset", listener: (key: string) => void): unknown;
}

export interface ApplicationLifecycle {
  start(): Promise<void>;
  reload(): Promise<void>;
  stop(): Promise<void>;
}

export interface AppControllerLogger {
  error(message: string, error: unknown): void;
}

export class OpenCcuAppController {
  readonly #settings: SettingsEvents;
  readonly #lifecycle: ApplicationLifecycle;
  readonly #logger: AppControllerLogger;
  #started = false;
  readonly #onSettingsChanged = (key: string): void => {
    if (key !== OPENCCU_CONNECTIONS_SETTING) return;
    void this.#lifecycle
      .reload()
      .catch((error: unknown) => this.#logger.error("Failed to reload OpenCCU settings", error));
  };

  constructor(
    settings: SettingsEvents,
    lifecycle: ApplicationLifecycle,
    logger: AppControllerLogger,
  ) {
    this.#settings = settings;
    this.#lifecycle = lifecycle;
    this.#logger = logger;
  }

  async start(): Promise<void> {
    if (this.#started) return;
    await this.#lifecycle.start();
    this.#settings.on("set", this.#onSettingsChanged);
    this.#settings.on("unset", this.#onSettingsChanged);
    this.#started = true;
  }

  async stop(): Promise<void> {
    if (this.#started) {
      this.#settings.removeListener("set", this.#onSettingsChanged);
      this.#settings.removeListener("unset", this.#onSettingsChanged);
      this.#started = false;
    }
    await this.#lifecycle.stop();
  }
}
