import { statusDefinition, statusTokens } from "./status-flow-controller";
import { handleStateToken } from "./handle-state-updates";
import Homey from "homey";

import {
  DeviceBindingController,
  type HomeyDevicePort,
} from "./device-binding-controller";
import { isRuntimeProvidingApp } from "./runtime-providing-app";
import { parseStoredBindings } from "./stored-bindings";
import type { RpcValue } from "../protocol/xmlrpc/types";
import { resolveDeviceMapping } from "../mapping/device-resolver";
import { resolveOrganizationCapabilities } from "./device-organization-capabilities";
import { CapabilityWriteListeners } from "./capability-write-listeners";
import { safeErrorSummary } from "../diagnostics/safe-error";

export abstract class RuntimeBackedDevice extends Homey.Device {
  #controller?: DeviceBindingController;
  readonly #writeListeners = new CapabilityWriteListeners(
    (capability, listener) => {
      this.registerCapabilityListener(capability, (value: RpcValue) =>
        listener(value),
      );
    },
  );

  async refreshOpenCcuRuntime(): Promise<void> {
    this.#controller?.stop();
    this.#controller = undefined;
    await this.onInit();
  }

  async onInit(): Promise<void> {
    const data = this.getData() as unknown;
    if (
      !isRecord(data) ||
      typeof data.centralId !== "string" ||
      typeof data.interfaceId !== "string" ||
      typeof data.address !== "string"
    ) {
      await this.setUnavailable("Invalid OpenCCU device identity");
      return;
    }
    const logicalId =
      typeof data.logicalId === "string" ? data.logicalId : undefined;
    const preserveLegacyGeneric = this.getStoreValue("generic") === true;
    const app = this.homey.app;
    if (!isRuntimeProvidingApp(app)) {
      await this.setUnavailable("OpenCCU runtime is not initialized");
      return;
    }
    const runtime = app.runtimeProvider.get(data.centralId, data.interfaceId);
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
        createDevicePort(this, this.#writeListeners),
        bindings,
        {
          isMappingComplete: () => {
            const device = runtime.devices.get(data.address as string);
            return device !== undefined && device.discoveryComplete !== false;
          },
          resolveBindings: () => {
            const device = runtime.devices.get(data.address as string);
            return device === undefined
              ? undefined
              : resolveDeviceMapping(
                  device,
                  undefined,
                  logicalId,
                  preserveLegacyGeneric,
                ).bindings;
          },
          resolveButtonEvents: () => {
            const device = runtime.devices.get(data.address as string);
            return device === undefined
              ? []
              : resolveDeviceMapping(
                  device,
                  undefined,
                  logicalId,
                  preserveLegacyGeneric,
                ).buttonEvents;
          },
          resolveInformationalCapabilities: () => {
            const device = runtime.devices.get(data.address as string);
            if (device === undefined) return {};
            const mapping = resolveDeviceMapping(
              device,
              undefined,
              logicalId,
              preserveLegacyGeneric,
            );
            return resolveOrganizationCapabilities(
              runtime.metadata,
              device.address,
              mapping,
            );
          },
          persistBindings: async (updatedBindings) => {
            await this.setStoreValue("bindings", updatedBindings);
          },
        },
      );
      await this.#controller.start();
    } catch (error) {
      this.error(
        "Failed to initialize OpenCCU device",
        safeErrorSummary(error),
      );
      await this.setUnavailable(
        "Invalid or unsupported OpenCCU device mapping",
      );
    }
  }

  onUninit(): Promise<void> {
    this.#controller?.stop();
    return Promise.resolve();
  }
}

function createDevicePort(
  device: Homey.Device,
  writes: CapabilityWriteListeners,
): HomeyDevicePort {
  return {
    getCapabilities: () => device.getCapabilities(),
    addCapability: (capability) => device.addCapability(capability),
    removeCapability: async (capability) => {
      await device.removeCapability(capability);
      writes.removed(capability);
    },
    setCapabilityValue: (capability, value) =>
      device.setCapabilityValue(capability, value),
    triggerStatusChanged: async (capability, value) => {
      const definition = statusDefinition(capability);
      if (definition)
        await device.homey.flow
          .getDeviceTriggerCard(definition.trigger)
          .trigger(
            device,
            statusTokens(
              capability,
              value,
              device.homey.i18n.getLanguage(),
              (id) => device.getCapabilityValue(id) as unknown,
            ),
            {},
          );
    },
    triggerHandleStateChanged: async (state) => {
      await device.homey.flow
        .getDeviceTriggerCard("handle_state_changed")
        .trigger(
          device,
          {
            handle_state: handleStateToken(state, (key) =>
              device.homey.__(key),
            ),
          },
          {},
        );
    },
    triggerButtonEvent: async (button, pressType) => {
      await device.homey.flow
        .getDeviceTriggerCard("hmip_button_pressed")
        .trigger(device, { button, press_type: pressType }, {});
    },
    onCapabilityWrite: (capability, listener) =>
      writes.bind(capability, listener),
    setAvailable: async () => {
      await device.setAvailable();
    },
    setUnavailable: async (message) => {
      await device.setUnavailable(message);
    },
    log: (message) => device.log(message),
    error: (message, error) => device.error(message, safeErrorSummary(error)),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
