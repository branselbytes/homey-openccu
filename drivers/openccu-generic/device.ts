import Homey from "homey";

import {
  DeviceBindingController,
  type HomeyDevicePort,
} from "../../src/homey/device-binding-controller";
import { isRuntimeProvidingApp } from "../../src/homey/runtime-providing-app";
import { parseStoredBindings } from "../../src/homey/stored-bindings";
import type { RpcValue } from "../../src/protocol/xmlrpc/types";

export = class OpenCcuGenericDevice extends Homey.Device {
  #controller?: DeviceBindingController;

  async onInit(): Promise<void> {
    const data = this.getData() as unknown;
    if (!isRecord(data) || typeof data.centralId !== "string") {
      await this.setUnavailable("Invalid OpenCCU device identity");
      return;
    }
    const app = this.homey.app;
    if (!isRuntimeProvidingApp(app)) {
      await this.setUnavailable("OpenCCU runtime is not initialized");
      return;
    }
    const runtime = app.runtimeProvider.get(data.centralId);
    if (!runtime) {
      await this.setUnavailable("Configured OpenCCU is unavailable");
      return;
    }

    try {
      const bindings = parseStoredBindings(
        this.getStoreValue("bindings") as unknown,
      );
      this.#controller = new DeviceBindingController(
        runtime,
        createDevicePort(this),
        bindings,
      );
      await this.#controller.start();
    } catch (error) {
      this.error("Failed to initialize generic OpenCCU device", error);
      await this.setUnavailable(
        "Invalid or unsupported OpenCCU device mapping",
      );
    }
  }

  onUninit(): Promise<void> {
    this.#controller?.stop();
    return Promise.resolve();
  }
};

function createDevicePort(device: Homey.Device): HomeyDevicePort {
  return {
    getCapabilities: () => device.getCapabilities(),
    addCapability: (capability) => device.addCapability(capability),
    removeCapability: (capability) => device.removeCapability(capability),
    setCapabilityValue: (capability, value) =>
      device.setCapabilityValue(capability, value),
    onCapabilityWrite: (capability, listener) => {
      device.registerCapabilityListener(capability, (value: RpcValue) =>
        listener(value),
      );
      return () => undefined;
    },
    setAvailable: async () => {
      await device.setAvailable();
    },
    setUnavailable: async (message) => {
      await device.setUnavailable(message);
    },
    error: (message, error) => device.error(message, error),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
