import type { RpcValue } from "../protocol/xmlrpc/types";
import {
  statusDefinition,
  validStatus,
  type StatusValue,
} from "./status-flow-controller";
/** Serial updates ensure conditions see the triggering value. Read revisions
 * prevent delayed initialization from overwriting a newer callback. */
export class StatusUpdates {
  #epoch = 0;
  readonly #states = new Map<string, StatusValue>();
  readonly #revisions = new Map<string, number>();
  readonly #queues = new Map<string, Promise<void>>();
  constructor(
    readonly setValue: (id: string, value: RpcValue) => Promise<void>,
    readonly trigger: (id: string, value: StatusValue) => Promise<void>,
    readonly onError: (error: unknown) => void,
  ) {}
  revision(id: string): number {
    if (!this.#revisions.has(id)) this.#revisions.set(id, 0);
    return this.#revisions.get(id)!;
  }
  reset(): void {
    this.#epoch++;
    this.#states.clear();
    for (const id of this.#revisions.keys())
      this.#revisions.set(id, this.revision(id) + 1);
  }
  update(
    id: string,
    value: RpcValue,
    live = false,
    revision = this.revision(id),
  ): Promise<void> {
    const definition = statusDefinition(id);
    if (!definition) return this.setValue(id, value);
    if (live) this.#revisions.set(id, this.revision(id) + 1);
    else if (!this.#revisions.has(id)) this.#revisions.set(id, revision);
    const epoch = this.#epoch;
    const task = (this.#queues.get(id) ?? Promise.resolve())
      .then(async () => {
        if (epoch !== this.#epoch || (!live && revision !== this.revision(id)))
          return;
        const previous = this.#states.get(id);
        const next = validStatus(definition, value) ? value : undefined;
        await this.setValue(id, next ?? null);
        if (epoch !== this.#epoch) return;
        if (next === undefined) this.#states.delete(id);
        else this.#states.set(id, next);
        if (
          live &&
          previous !== undefined &&
          next !== undefined &&
          !Object.is(previous, next)
        )
          await this.trigger(id, next);
      })
      .catch((error) => {
        if (epoch === this.#epoch) this.#states.delete(id);
        this.onError(error);
      });
    this.#queues.set(id, task);
    return task;
  }
}
