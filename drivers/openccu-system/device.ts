import Homey from "homey";

import { isRuntimeProvidingApp } from "../../src/homey/runtime-providing-app";
import { SystemDeviceController } from "../../src/homey/system-device-controller";
import { safeErrorKind } from "../../src/diagnostics/safe-error";

export = class OpenCcuSystemDevice extends Homey.Device {
  #controller?: SystemDeviceController;

  async onInit(): Promise<void> {
    const data = this.getData() as unknown;
    if (!isRecord(data) || typeof data.centralId !== "string") {
      await this.setUnavailable("Invalid OpenCCU system-device identity");
      return;
    }
    const app = this.homey.app;
    if (!isRuntimeProvidingApp(app)) {
      await this.setUnavailable("OpenCCU runtime is not initialized");
      return;
    }
    const runtime = app.runtimeProvider.get(data.centralId);
    if (runtime === undefined) {
      await this.setUnavailable("Configured OpenCCU is unavailable");
      return;
    }

    this.#controller = new SystemDeviceController(runtime, {
      setCapabilityValue: (capability, value) =>
        this.setCapabilityValue(capability, value),
      setAvailable: () => this.setAvailable(),
      setUnavailable: (message) => this.setUnavailable(message),
      error: (message, error) => this.error(message, safeErrorKind(error)),
    });
    await this.#controller.start();
  }

  onUninit(): Promise<void> {
    this.#controller?.stop();
    return Promise.resolve();
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
