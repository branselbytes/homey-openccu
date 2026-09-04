import type { Unsubscribe } from "../events/event-bus";
import type {
  ButtonEventBinding,
  ButtonPressType,
  CapabilityBinding,
} from "../mapping/types";
import type { RpcValue } from "../protocol/xmlrpc/types";
import type { OpenCcuRuntime } from "../runtime/openccu-runtime";
import { transformFromOpenCcu } from "../mapping/transforms";
import { reconcileCapabilities } from "./capability-reconciliation";

const WRITE_ACKNOWLEDGEMENT_MS = 1_500;
const WRITE_VERIFICATION_DELAYS_MS = [3_000, 10_000, 20_000] as const;

type WriteOutcome =
  | { readonly status: "confirmed" }
  | { readonly status: "failed"; readonly error: unknown };

interface PendingWrite {
  readonly binding: CapabilityBinding;
  readonly expected: RpcValue;
  timer?: ReturnType<typeof setTimeout>;
}

export interface HomeyDevicePort {
  getCapabilities(): readonly string[];
  addCapability(capability: string): Promise<void>;
  removeCapability(capability: string): Promise<void>;
  setCapabilityValue(capability: string, value: RpcValue): Promise<void>;
  triggerButtonEvent(button: number, pressType: ButtonPressType): Promise<void>;
  onCapabilityWrite(
    capability: string,
    listener: (value: RpcValue) => Promise<void>,
  ): Unsubscribe;
  setAvailable(): Promise<void>;
  setUnavailable(message: string): Promise<void>;
  log(message: string): void;
  error(message: string, error: unknown): void;
}

export interface DeviceBindingControllerOptions {
  readonly resolveBindings?: () => readonly CapabilityBinding[] | undefined;
  readonly persistBindings?: (
    bindings: readonly CapabilityBinding[],
  ) => Promise<void>;
  readonly resolveButtonEvents?: () => readonly ButtonEventBinding[];
}

export class DeviceBindingController {
  readonly #runtime: OpenCcuRuntime;
  readonly #device: HomeyDevicePort;
  readonly #options: DeviceBindingControllerOptions;
  #bindings: readonly CapabilityBinding[];
  #buttonEvents: readonly ButtonEventBinding[] = [];
  readonly #unsubscribers: Unsubscribe[] = [];
  readonly #pendingWrites = new Map<string, PendingWrite>();
  #activated = false;

  constructor(
    runtime: OpenCcuRuntime,
    device: HomeyDevicePort,
    bindings: readonly CapabilityBinding[],
    options: DeviceBindingControllerOptions = {},
  ) {
    this.#runtime = runtime;
    this.#device = device;
    this.#bindings = bindings;
    this.#options = options;
  }

  async start(): Promise<void> {
    this.#unsubscribers.push(
      this.#runtime.subscribe("datapoint", (event) => {
        for (const binding of this.#bindings) {
          if (
            event.channelAddress === binding.channelAddress &&
            event.parameter === binding.parameter
          ) {
            this.#confirmPendingWriteFromEvent(binding, event.value);
            void this.#setValue(
              binding,
              transformFromOpenCcu(binding.transform, event.value),
            );
          }
        }
        for (const binding of this.#buttonEvents) {
          if (
            event.channelAddress === binding.channelAddress &&
            event.parameter === binding.parameter
          ) {
            void this.#device
              .triggerButtonEvent(binding.button, binding.pressType)
              .catch((error: unknown) => {
                this.#device.error(
                  `Failed to trigger button ${binding.button} ${binding.pressType} event`,
                  error,
                );
              });
          }
        }
      }),
      this.#runtime.subscribe("connection", ({ state }) => {
        if (state === "healthy") void this.#activate();
        if (state === "disconnected") {
          void this.#device.setUnavailable(
            "OpenCCU HmIP-RF connection unavailable",
          );
        }
      }),
    );
    if (this.#runtime.connectionState === "healthy") {
      await this.#activate();
    } else {
      await this.#device.setUnavailable(
        "Waiting for OpenCCU HmIP-RF connection",
      );
    }
  }

  async #activate(): Promise<void> {
    if (!this.#activated) {
      this.#buttonEvents = this.#options.resolveButtonEvents?.() ?? [];
      const resolved = this.#options.resolveBindings?.();
      if (resolved !== undefined && !bindingsEqual(this.#bindings, resolved)) {
        this.#bindings = resolved;
        await this.#options.persistBindings?.(resolved);
        this.#device.log(
          "Updated stored bindings from current OpenCCU discovery",
        );
      }
      await this.#reconcile();
      for (const binding of this.#bindings) {
        if (!binding.writable) continue;
        this.#unsubscribers.push(
          this.#device.onCapabilityWrite(binding.capability, async (value) => {
            const target = `${binding.writeChannelAddress}/${binding.writeParameter}`;
            this.#device.log(`Writing ${binding.capability} to ${target}`);
            const pending = this.#beginWriteVerification(binding, value);
            const writeOutcome: Promise<WriteOutcome> = this.#runtime
              .write(binding, value)
              .then(
                (): WriteOutcome => ({ status: "confirmed" }),
                (error: unknown): WriteOutcome => ({ status: "failed", error }),
              );
            const outcome = await Promise.race([
              writeOutcome,
              waitForPendingWrite(),
            ]);
            if (outcome.status === "pending") {
              this.#device.log(
                `Accepted ${binding.capability} write to ${target}; awaiting OpenCCU confirmation`,
              );
              void writeOutcome.then((lateOutcome) => {
                this.#scheduleWriteVerification(pending, 0);
                if (lateOutcome.status === "confirmed") {
                  this.#device.log(
                    `Confirmed ${binding.capability} write to ${target}`,
                  );
                } else {
                  this.#device.error(
                    `OpenCCU did not confirm ${binding.capability} write to ${target}`,
                    lateOutcome.error,
                  );
                }
              });
              return;
            }
            if (outcome.status === "confirmed") {
              this.#device.log(`Wrote ${binding.capability} to ${target}`);
              this.#scheduleWriteVerification(pending, 0);
              return;
            }
            this.#clearPendingWrite(pending);
            this.#device.error(
              `Failed to write ${binding.capability} to ${target}`,
              outcome.error,
            );
            throw outcome.error;
          }),
        );
      }
      this.#activated = true;
    }
    await this.#device.setAvailable();
    await this.#readInitialValues();
  }

  stop(): void {
    for (const unsubscribe of this.#unsubscribers.splice(0)) unsubscribe();
    for (const pending of this.#pendingWrites.values()) {
      if (pending.timer !== undefined) clearTimeout(pending.timer);
    }
    this.#pendingWrites.clear();
  }

  async #reconcile(): Promise<void> {
    const changes = reconcileCapabilities(
      this.#device.getCapabilities(),
      this.#bindings.map((binding) => binding.capability),
    );
    for (const capability of changes.remove)
      await this.#device.removeCapability(capability);
    for (const capability of changes.add)
      await this.#device.addCapability(capability);
  }

  async #readInitialValues(): Promise<void> {
    const byChannel = new Map<string, CapabilityBinding[]>();
    for (const binding of this.#bindings.filter(({ readable }) => readable)) {
      const bindings = byChannel.get(binding.channelAddress) ?? [];
      bindings.push(binding);
      byChannel.set(binding.channelAddress, bindings);
    }
    for (const [channelAddress, bindings] of byChannel) {
      try {
        const values = await this.#runtime.readChannelValues(channelAddress);
        for (const binding of bindings) {
          if (!(binding.parameter in values)) continue;
          await this.#setValue(
            binding,
            transformFromOpenCcu(binding.transform, values[binding.parameter]),
          );
        }
      } catch (error) {
        this.#device.error(
          `Failed to read OpenCCU channel ${channelAddress}`,
          error,
        );
      }
    }
  }

  async #setValue(binding: CapabilityBinding, value: RpcValue): Promise<void> {
    try {
      await this.#device.setCapabilityValue(binding.capability, value);
    } catch (error) {
      this.#device.error(`Failed to update ${binding.capability}`, error);
    }
  }

  #beginWriteVerification(
    binding: CapabilityBinding,
    expected: RpcValue,
  ): PendingWrite {
    const previous = this.#pendingWrites.get(binding.capability);
    if (previous?.timer !== undefined) clearTimeout(previous.timer);
    const pending = { binding, expected };
    this.#pendingWrites.set(binding.capability, pending);
    return pending;
  }

  #scheduleWriteVerification(pending: PendingWrite, attempt: number): void {
    if (this.#pendingWrites.get(pending.binding.capability) !== pending) return;
    const delay = WRITE_VERIFICATION_DELAYS_MS[attempt];
    if (delay === undefined) return;
    pending.timer = setTimeout(() => {
      void this.#verifyWrite(pending, attempt);
    }, delay);
  }

  async #verifyWrite(pending: PendingWrite, attempt: number): Promise<void> {
    if (this.#pendingWrites.get(pending.binding.capability) !== pending) return;
    try {
      const actual = await this.#runtime.read(pending.binding);
      if (rpcValuesEqual(actual, pending.expected)) {
        this.#device.log(`Verified ${pending.binding.capability} from OpenCCU`);
        this.#clearPendingWrite(pending);
        await this.#setValue(pending.binding, actual);
        return;
      }
      if (attempt + 1 < WRITE_VERIFICATION_DELAYS_MS.length) {
        this.#scheduleWriteVerification(pending, attempt + 1);
        return;
      }
      this.#device.error(
        `OpenCCU read-back differs for ${pending.binding.capability}`,
        new Error("Written value was not observed"),
      );
      this.#clearPendingWrite(pending);
      await this.#setValue(pending.binding, actual);
    } catch (error) {
      if (attempt + 1 < WRITE_VERIFICATION_DELAYS_MS.length) {
        this.#scheduleWriteVerification(pending, attempt + 1);
        return;
      }
      this.#device.error(
        `Unable to verify ${pending.binding.capability} from OpenCCU`,
        error,
      );
      this.#clearPendingWrite(pending);
      await this.#device.setUnavailable(
        "OpenCCU command delivery could not be verified",
      );
    }
  }

  #confirmPendingWriteFromEvent(
    binding: CapabilityBinding,
    value: RpcValue,
  ): void {
    const pending = this.#pendingWrites.get(binding.capability);
    if (pending === undefined) return;
    const actual = transformFromOpenCcu(binding.transform, value);
    if (!rpcValuesEqual(actual, pending.expected)) return;
    this.#device.log(`Verified ${binding.capability} from OpenCCU event`);
    this.#clearPendingWrite(pending);
  }

  #clearPendingWrite(pending: PendingWrite): void {
    if (this.#pendingWrites.get(pending.binding.capability) !== pending) return;
    if (pending.timer !== undefined) clearTimeout(pending.timer);
    this.#pendingWrites.delete(pending.binding.capability);
  }
}

async function waitForPendingWrite(): Promise<{ readonly status: "pending" }> {
  await new Promise<void>((resolve) =>
    setTimeout(resolve, WRITE_ACKNOWLEDGEMENT_MS),
  );
  return { status: "pending" };
}

function rpcValuesEqual(left: RpcValue, right: RpcValue): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
}

function bindingsEqual(
  left: readonly CapabilityBinding[],
  right: readonly CapabilityBinding[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
