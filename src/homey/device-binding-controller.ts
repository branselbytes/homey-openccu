import type { Unsubscribe } from "../events/event-bus";
import type { CapabilityBinding } from "../mapping/types";
import type { RpcValue } from "../protocol/xmlrpc/types";
import type { OpenCcuRuntime } from "../runtime/openccu-runtime";
import { transformFromOpenCcu } from "../mapping/transforms";
import { reconcileCapabilities } from "./capability-reconciliation";

export interface HomeyDevicePort {
  getCapabilities(): readonly string[];
  addCapability(capability: string): Promise<void>;
  removeCapability(capability: string): Promise<void>;
  setCapabilityValue(capability: string, value: RpcValue): Promise<void>;
  onCapabilityWrite(
    capability: string,
    listener: (value: RpcValue) => Promise<void>,
  ): Unsubscribe;
  setAvailable(): Promise<void>;
  setUnavailable(message: string): Promise<void>;
  error(message: string, error: unknown): void;
}

export class DeviceBindingController {
  readonly #runtime: OpenCcuRuntime;
  readonly #device: HomeyDevicePort;
  readonly #bindings: readonly CapabilityBinding[];
  readonly #unsubscribers: Unsubscribe[] = [];

  constructor(
    runtime: OpenCcuRuntime,
    device: HomeyDevicePort,
    bindings: readonly CapabilityBinding[],
  ) {
    this.#runtime = runtime;
    this.#device = device;
    this.#bindings = bindings;
  }

  async start(): Promise<void> {
    await this.#reconcile();
    for (const binding of this.#bindings) {
      if (binding.writable) {
        this.#unsubscribers.push(
          this.#device.onCapabilityWrite(binding.capability, (value) =>
            this.#runtime.write(binding, value),
          ),
        );
      }
      if (binding.readable) await this.#readInitial(binding);
    }
    this.#unsubscribers.push(
      this.#runtime.subscribe("datapoint", (event) => {
        for (const binding of this.#bindings) {
          if (
            event.channelAddress === binding.channelAddress &&
            event.parameter === binding.parameter
          ) {
            void this.#setValue(
              binding,
              transformFromOpenCcu(binding.transform, event.value),
            );
          }
        }
      }),
      this.#runtime.subscribe("connection", ({ state }) => {
        if (state === "healthy") void this.#device.setAvailable();
        if (state === "disconnected") {
          void this.#device.setUnavailable("OpenCCU HmIP-RF connection unavailable");
        }
      }),
    );
  }

  stop(): void {
    for (const unsubscribe of this.#unsubscribers.splice(0)) unsubscribe();
  }

  async #reconcile(): Promise<void> {
    const changes = reconcileCapabilities(
      this.#device.getCapabilities(),
      this.#bindings.map((binding) => binding.capability),
    );
    for (const capability of changes.remove) await this.#device.removeCapability(capability);
    for (const capability of changes.add) await this.#device.addCapability(capability);
  }

  async #readInitial(binding: CapabilityBinding): Promise<void> {
    try {
      await this.#setValue(binding, await this.#runtime.read(binding));
    } catch (error) {
      this.#device.error(`Failed to read ${binding.capability}`, error);
    }
  }

  async #setValue(binding: CapabilityBinding, value: RpcValue): Promise<void> {
    try {
      await this.#device.setCapabilityValue(binding.capability, value);
    } catch (error) {
      this.#device.error(`Failed to update ${binding.capability}`, error);
    }
  }
}
