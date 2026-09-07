import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SYSTEM_INFORMATION_REFRESH_INTERVAL_MS,
  SystemDeviceController,
  type SystemDeviceRuntime,
} from "../../src/homey/system-device-controller";

function createDevice() {
  return {
    setCapabilityValue: vi.fn().mockResolvedValue(undefined),
    setAvailable: vi.fn().mockResolvedValue(undefined),
    setUnavailable: vi.fn().mockResolvedValue(undefined),
    error: vi.fn(),
  };
}

describe("SystemDeviceController", () => {
  afterEach(() => vi.useRealTimers());

  it("publishes connection, inventory, radio, and service status", async () => {
    vi.useFakeTimers();
    const refreshSystemInformation = vi.fn().mockResolvedValue({
      information: {
        serviceMessageCount: 2,
        dutyCycle: 18,
        carrierSense: 7,
        radioInterfaces: [],
      },
      issues: [],
    });
    const runtime: SystemDeviceRuntime = {
      connectionState: "healthy",
      devices: new Map([
        ["one", {}],
        ["two", {}],
      ]),
      refreshSystemInformation,
      subscribe: vi.fn().mockReturnValue(vi.fn()),
    };
    const device = createDevice();
    const controller = new SystemDeviceController(runtime, device);

    await controller.start();

    expect(device.setAvailable).toHaveBeenCalledOnce();
    expect(device.setCapabilityValue).toHaveBeenCalledWith(
      "openccu_connection_status",
      "healthy",
    );
    expect(device.setCapabilityValue).toHaveBeenCalledWith(
      "openccu_measure_devices",
      2,
    );
    expect(device.setCapabilityValue).toHaveBeenCalledWith(
      "openccu_measure_service_messages",
      2,
    );
    expect(device.setCapabilityValue).toHaveBeenCalledWith(
      "openccu_alarm_service_messages",
      true,
    );
    expect(device.setCapabilityValue).toHaveBeenCalledWith(
      "openccu_measure_duty_cycle",
      18,
    );
    expect(device.setCapabilityValue).toHaveBeenCalledWith(
      "openccu_measure_carrier_sense",
      7,
    );

    await vi.advanceTimersByTimeAsync(SYSTEM_INFORMATION_REFRESH_INTERVAL_MS);
    expect(refreshSystemInformation).toHaveBeenCalledTimes(2);
    controller.stop();
  });

  it("marks an unhealthy OpenCCU unavailable without polling it", async () => {
    vi.useFakeTimers();
    const unsubscribe = vi.fn();
    const refreshSystemInformation = vi.fn();
    const runtime: SystemDeviceRuntime = {
      connectionState: "disconnected",
      devices: new Map(),
      refreshSystemInformation,
      subscribe: vi.fn().mockReturnValue(unsubscribe),
    };
    const device = createDevice();
    const controller = new SystemDeviceController(runtime, device);

    await controller.start();

    expect(device.setUnavailable).toHaveBeenCalledWith(
      "OpenCCU connection is disconnected",
    );
    expect(refreshSystemInformation).not.toHaveBeenCalled();
    controller.stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
