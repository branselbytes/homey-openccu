import type { Unsubscribe } from "../events/event-bus";
import type { ConnectionState } from "../protocol/connection-supervisor";
import type { OpenCcuSystemInformationResult } from "../protocol/jsonrpc/system-information";

export const SYSTEM_INFORMATION_REFRESH_INTERVAL_MS = 60_000;

export interface SystemDeviceRuntime {
  readonly connectionState: ConnectionState;
  readonly devices: ReadonlyMap<string, unknown>;
  refreshSystemInformation(
    signal?: AbortSignal,
  ): Promise<OpenCcuSystemInformationResult | undefined>;
  subscribe(
    key: "connection",
    listener: (event: { readonly state: ConnectionState }) => void,
  ): Unsubscribe;
}

export interface SystemDevicePort {
  setCapabilityValue(
    capability: string,
    value: string | number | boolean | null,
  ): Promise<void>;
  setAvailable(): Promise<void>;
  setUnavailable(message: string): Promise<void>;
  error(message: string, error: unknown): void;
}

export class SystemDeviceController {
  readonly #runtime: SystemDeviceRuntime;
  readonly #device: SystemDevicePort;
  #unsubscribe?: Unsubscribe;
  #timer?: ReturnType<typeof setInterval>;
  #refreshPromise?: Promise<void>;
  #stopped = false;

  constructor(runtime: SystemDeviceRuntime, device: SystemDevicePort) {
    this.#runtime = runtime;
    this.#device = device;
  }

  async start(): Promise<void> {
    this.#stopped = false;
    this.#unsubscribe = this.#runtime.subscribe("connection", ({ state }) => {
      void this.#applyConnectionState(state);
    });
    await this.#applyConnectionState(this.#runtime.connectionState);
    this.#timer = setInterval(
      () => void this.refresh(),
      SYSTEM_INFORMATION_REFRESH_INTERVAL_MS,
    );
  }

  stop(): void {
    this.#stopped = true;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    if (this.#timer !== undefined) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  refresh(): Promise<void> {
    if (this.#refreshPromise !== undefined) return this.#refreshPromise;
    this.#refreshPromise = this.#refresh().finally(() => {
      this.#refreshPromise = undefined;
    });
    return this.#refreshPromise;
  }

  async #refresh(): Promise<void> {
    if (this.#stopped || this.#runtime.connectionState !== "healthy") return;
    try {
      await this.#device.setCapabilityValue(
        "openccu_measure_devices",
        this.#runtime.devices.size,
      );
      const result = await this.#runtime.refreshSystemInformation();
      if (this.#stopped || result === undefined) return;
      const { information } = result;
      await Promise.all([
        this.#device.setCapabilityValue(
          "openccu_measure_service_messages",
          information.serviceMessageCount ?? null,
        ),
        this.#device.setCapabilityValue(
          "openccu_alarm_service_messages",
          information.serviceMessageCount === undefined
            ? null
            : information.serviceMessageCount > 0,
        ),
        this.#device.setCapabilityValue(
          "openccu_measure_duty_cycle",
          information.dutyCycle ?? null,
        ),
        this.#device.setCapabilityValue(
          "openccu_measure_carrier_sense",
          information.carrierSense ?? null,
        ),
      ]);
    } catch (error) {
      this.#device.error("Failed to refresh OpenCCU system information", error);
    }
  }

  async #applyConnectionState(state: ConnectionState): Promise<void> {
    await this.#device.setCapabilityValue("openccu_connection_status", state);
    if (state === "healthy") {
      await this.#device.setAvailable();
      await this.refresh();
      return;
    }
    await this.#device.setUnavailable(`OpenCCU connection is ${state}`);
  }
}
