import type { RpcValue } from "../protocol/xmlrpc/types";

type Listener = (value: RpcValue) => Promise<void>;

/** One Homey registration per capability, with a replaceable controller target. */
export class CapabilityWriteListeners {
  readonly #registered = new Set<string>();
  readonly #targets = new Map<string, Listener>();

  constructor(
    readonly register: (capability: string, listener: Listener) => void,
  ) {}

  bind(capability: string, listener: Listener): () => void {
    if (!this.#registered.has(capability)) {
      this.register(capability, (value) => {
        const target = this.#targets.get(capability);
        if (!target)
          return Promise.reject(
            new Error("OpenCCU device controller unavailable"),
          );
        return target(value);
      });
      this.#registered.add(capability);
    }
    this.#targets.set(capability, listener);
    return () => {
      if (this.#targets.get(capability) === listener)
        this.#targets.delete(capability);
    };
  }

  /** Called only after Homey successfully removes the capability itself. */
  removed(capability: string): void {
    this.#registered.delete(capability);
    this.#targets.delete(capability);
  }
}
