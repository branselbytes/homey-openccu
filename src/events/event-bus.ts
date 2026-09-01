export type EventMap = Record<string, unknown>;
export type Unsubscribe = () => void;

export class TypedEventBus<Events extends EventMap> {
  readonly #listeners = new Map<keyof Events, Set<(event: Events[keyof Events]) => void>>();

  subscribe<Key extends keyof Events>(key: Key, listener: (event: Events[Key]) => void): Unsubscribe {
    const listeners = this.#listeners.get(key) ?? new Set();
    listeners.add(listener as (event: Events[keyof Events]) => void);
    this.#listeners.set(key, listeners);
    return () => {
      listeners.delete(listener as (event: Events[keyof Events]) => void);
      if (listeners.size === 0) this.#listeners.delete(key);
    };
  }

  publish<Key extends keyof Events>(key: Key, event: Events[Key]): void {
    for (const listener of [...(this.#listeners.get(key) ?? [])]) listener(event);
  }

  clear(): void {
    this.#listeners.clear();
  }
}
