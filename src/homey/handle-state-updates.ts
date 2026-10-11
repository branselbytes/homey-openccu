import type { RpcValue } from "../protocol/xmlrpc/types";

export type HandleState = "0" | "1" | "2";
const STATE_NAMES = { "0": "closed", "1": "tilted", "2": "open" } as const;

export function handleStateToken(
  state: HandleState,
  translate: (key: string) => string,
): string {
  return translate(`handle_state.${STATE_NAMES[state]}`);
}

/** Serializes handle updates so Flow conditions observe the triggering state. */
export class HandleStateUpdates {
  #state: HandleState | undefined;
  #revision = 0;
  #epoch = 0;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    readonly setValue: (value: HandleState | null) => Promise<void>,
    readonly trigger: (state: HandleState) => Promise<void>,
    readonly onError: (error: unknown) => void,
  ) {}

  get revision(): number {
    return this.#revision;
  }

  reset(): void {
    this.#epoch += 1;
    this.#revision += 1;
    this.#state = undefined;
  }

  update(
    value: RpcValue,
    live = false,
    readRevision = this.#revision,
  ): Promise<void> {
    if (!live && readRevision !== this.#revision) return Promise.resolve();
    if (live) this.#revision += 1;
    const epoch = this.#epoch;
    this.#queue = this.#queue
      .then(async () => {
        if (epoch !== this.#epoch) return;
        const next =
          value === "0" || value === "1" || value === "2" ? value : undefined;
        const previous = this.#state;
        await this.setValue(next ?? null);
        if (epoch !== this.#epoch) return;
        this.#state = next;
        if (
          live &&
          previous !== undefined &&
          next !== undefined &&
          previous !== next
        ) {
          await this.trigger(next);
        }
      })
      .catch((error) => {
        this.#state = undefined;
        this.onError(error);
      });
    return this.#queue;
  }
}
