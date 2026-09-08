import { describe, expect, it, vi } from "vitest";

import type { CapabilityBinding } from "../../src/mapping/types";
import type { XmlRpcClient } from "../../src/protocol/xmlrpc/types";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";

const binding: CapabilityBinding = {
  capability: "onoff",
  channelAddress: "301:3",
  parameter: "STATE",
  writeChannelAddress: "301:4",
  writeParameter: "STATE",
  readable: true,
  writable: true,
  transform: "boolean",
};

function fixture() {
  const setValue = vi.fn().mockResolvedValue(undefined);
  const getValue = vi.fn().mockResolvedValue(1);
  const getParamset = vi.fn().mockResolvedValue({ STATE: true });
  const client: XmlRpcClient = {
    listDevices: vi.fn(),
    getParamsetDescription: vi.fn(),
    getValue,
    getParamset,
    setValue,
    putParamset: vi.fn(),
    init: vi.fn(),
  };
  const runtime = new OpenCcuRuntime(client, {
    centralId: "ccu-1",
    interfaceId: "HmIP-RF",
  });
  let writeListener: ((value: boolean) => Promise<void>) | undefined;
  const setCapabilityValue = vi.fn().mockResolvedValue(undefined);
  const capabilities = new Set(["old_capability"]);
  const device = {
    getCapabilities: () => [...capabilities],
    addCapability: vi.fn((capability: string) => {
      capabilities.add(capability);
      return Promise.resolve();
    }),
    removeCapability: vi.fn((capability: string) => {
      capabilities.delete(capability);
      return Promise.resolve();
    }),
    setCapabilityValue,
    triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
    onCapabilityWrite: vi.fn(
      (_: string, listener: (value: boolean) => Promise<void>) => {
        writeListener = listener;
        return vi.fn();
      },
    ),
    setAvailable: vi.fn().mockResolvedValue(undefined),
    setUnavailable: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
  };
  return {
    runtime,
    device,
    setValue,
    getParamset,
    setCapabilityValue,
    getWriteListener: () => writeListener,
  };
}

describe("DeviceBindingController", () => {
  it("reconciles capabilities, reads initial state, writes to command targets, and routes events", async () => {
    const { runtime, device, setValue, setCapabilityValue, getWriteListener } =
      fixture();
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, device, [binding]);

    await controller.start();
    await getWriteListener()?.(false);
    await runtime
      .createCallbackDispatcher()
      .dispatch("event", ["HmIP-RF", "301:3", "STATE", false]);
    await Promise.resolve();

    expect(device.removeCapability).toHaveBeenCalledWith("old_capability");
    expect(device.addCapability).toHaveBeenCalledWith("onoff");
    expect(setCapabilityValue).toHaveBeenNthCalledWith(1, "onoff", true);
    expect(setCapabilityValue).toHaveBeenNthCalledWith(2, "onoff", false);
    expect(setValue).toHaveBeenCalledWith("301:4", "STATE", false, undefined);
    expect(device.log).toHaveBeenNthCalledWith(1, "Writing onoff to OpenCCU");
    expect(device.log).toHaveBeenNthCalledWith(2, "Wrote onoff to OpenCCU");
  });

  it("logs a failed write without logging its value and rethrows it", async () => {
    const { runtime, device, setValue, getWriteListener } = fixture();
    runtime.publishConnectionState("healthy");
    const failure = new Error("XML-RPC timeout");
    setValue.mockRejectedValueOnce(failure);
    const controller = new DeviceBindingController(runtime, device, [binding]);

    await controller.start();
    await expect(getWriteListener()?.(false)).rejects.toThrow(
      "XML-RPC timeout",
    );

    expect(device.log).toHaveBeenCalledWith("Writing onoff to OpenCCU");
    expect(device.error).toHaveBeenCalledWith(
      "Failed to write onoff to OpenCCU",
      failure,
    );
    expect(device.log).not.toHaveBeenCalledWith(
      expect.stringContaining("false"),
    );
  });

  it("acknowledges a slow write to Homey while awaiting OpenCCU confirmation", async () => {
    vi.useFakeTimers();
    try {
      const { runtime, device, setValue, getParamset, getWriteListener } =
        fixture();
      runtime.publishConnectionState("healthy");
      let confirmWrite: (() => void) | undefined;
      setValue.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            confirmWrite = resolve;
          }),
      );
      const controller = new DeviceBindingController(runtime, device, [
        binding,
      ]);
      await controller.start();

      const write = getWriteListener()?.(false);
      await vi.advanceTimersByTimeAsync(1_500);
      await expect(write).resolves.toBeUndefined();
      expect(device.log).toHaveBeenCalledWith(
        "Accepted onoff write; awaiting OpenCCU confirmation",
      );

      confirmWrite?.();
      getParamset.mockResolvedValueOnce({ STATE: false });
      await vi.advanceTimersByTimeAsync(3_000);
      await vi.waitFor(() =>
        expect(device.log).toHaveBeenCalledWith("Verified onoff from OpenCCU"),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("defers initial reads until the OpenCCU connection is healthy", async () => {
    const { runtime, device, setCapabilityValue } = fixture();
    runtime.publishConnectionState("connecting");
    const controller = new DeviceBindingController(runtime, device, [binding]);

    await controller.start();
    expect(setCapabilityValue).not.toHaveBeenCalled();
    expect(device.setUnavailable).toHaveBeenCalledWith(
      "Waiting for OpenCCU device interface",
    );

    runtime.publishConnectionState("healthy");
    await vi.waitFor(() => expect(setCapabilityValue).toHaveBeenCalledOnce());
    expect(device.setAvailable).toHaveBeenCalledOnce();
  });

  it("does not include a channel address in read error messages", async () => {
    const { runtime, device, getParamset } = fixture();
    runtime.publishConnectionState("healthy");
    getParamset.mockRejectedValueOnce(new Error("read failed"));
    const controller = new DeviceBindingController(runtime, device, [binding]);

    await controller.start();

    expect(device.error).toHaveBeenCalledWith(
      "Failed to read an OpenCCU channel",
      expect.any(Error),
    );
    expect(JSON.stringify(device.error.mock.calls)).not.toContain("301:3");
  });

  it("repairs stored bindings from current discovery before activation", async () => {
    const { runtime, device } = fixture();
    const repaired = {
      ...binding,
      channelAddress: "301:5",
      parameter: "LEVEL",
    };
    const persistBindings = vi.fn().mockResolvedValue(undefined);
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, device, [binding], {
      resolveBindings: () => [repaired],
      persistBindings,
    });

    await controller.start();

    expect(persistBindings).toHaveBeenCalledWith([repaired]);
    expect(device.log).toHaveBeenCalledWith(
      "Updated stored bindings from current OpenCCU discovery",
    );
  });

  it("routes resolved button datapoints to the Homey device trigger", async () => {
    const { runtime, device } = fixture();
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, device, [], {
      resolveButtonEvents: () => [
        {
          channelAddress: "301:2",
          parameter: "PRESS_LONG",
          button: 2,
          pressType: "long",
        },
      ],
    });
    await controller.start();

    await runtime
      .createCallbackDispatcher()
      .dispatch("event", ["HmIP-RF", "301:2", "PRESS_LONG", true]);
    await vi.waitFor(() =>
      expect(device.triggerButtonEvent).toHaveBeenCalledWith(2, "long"),
    );
  });

  it("reconciles read-only organization tags when metadata changes", async () => {
    const { runtime, device, setCapabilityValue } = fixture();
    let information: Record<string, string> = {
      openccu_room: "Workshop",
    };
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, device, [binding], {
      resolveInformationalCapabilities: () => information,
    });

    await controller.start();
    expect(device.addCapability).toHaveBeenCalledWith("openccu_room");
    expect(setCapabilityValue).toHaveBeenCalledWith("openccu_room", "Workshop");

    information = { openccu_functions: "Security" };
    runtime.updateMetadata({
      metadata: {
        names: new Map(),
        rooms: new Map(),
        functions: new Map(),
        programs: [],
        systemVariables: [],
      },
      issues: [],
    });

    await vi.waitFor(() =>
      expect(setCapabilityValue).toHaveBeenCalledWith(
        "openccu_functions",
        "Security",
      ),
    );
    expect(device.removeCapability).toHaveBeenCalledWith("openccu_room");
    expect(device.addCapability).toHaveBeenCalledWith("openccu_functions");
  });

  it("contains Homey Flow trigger failures at the device boundary", async () => {
    const { runtime, device } = fixture();
    const triggerError = new Error("trigger failed");
    device.triggerButtonEvent.mockRejectedValue(triggerError);
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, device, [], {
      resolveButtonEvents: () => [
        {
          channelAddress: "301:1",
          parameter: "PRESS_SHORT",
          button: 1,
          pressType: "short",
        },
      ],
    });
    await controller.start();

    await runtime
      .createCallbackDispatcher()
      .dispatch("event", ["HmIP-RF", "301:1", "PRESS_SHORT", true]);
    await vi.waitFor(() =>
      expect(device.error).toHaveBeenCalledWith(
        "Failed to trigger button 1 short event",
        triggerError,
      ),
    );
  });
});

it("adds a compass to an existing weather device and updates it with the degree value", async () => {
  const { runtime, device, getParamset, setCapabilityValue } = fixture();
  getParamset.mockResolvedValue({ WIND_DIRECTION: 90 });
  const angle: CapabilityBinding = {
    capability: "measure_wind_angle",
    channelAddress: "WEATHER:1",
    parameter: "WIND_DIRECTION",
    readable: true,
    writable: false,
    transform: "identity",
  };
  const compass: CapabilityBinding = {
    ...angle,
    capability: "homematic_wind_direction",
    transform: "degrees-to-compass-8",
  };
  const persistBindings = vi.fn().mockResolvedValue(undefined);
  runtime.publishConnectionState("healthy");
  const controller = new DeviceBindingController(runtime, device, [angle], {
    resolveBindings: () => [angle, compass],
    persistBindings,
  });
  await controller.start();
  expect(device.addCapability).toHaveBeenCalledWith("homematic_wind_direction");
  expect(persistBindings).toHaveBeenCalledWith([angle, compass]);
  expect(setCapabilityValue).toHaveBeenCalledWith("measure_wind_angle", 90);
  expect(setCapabilityValue).toHaveBeenCalledWith(
    "homematic_wind_direction",
    "e",
  );
  await runtime
    .createCallbackDispatcher()
    .dispatch("event", ["HmIP-RF", "WEATHER:1", "WIND_DIRECTION", 315]);
  expect(setCapabilityValue).toHaveBeenCalledWith("measure_wind_angle", 315);
  expect(setCapabilityValue).toHaveBeenLastCalledWith(
    "homematic_wind_direction",
    "nw",
  );
  expect(device.onCapabilityWrite).not.toHaveBeenCalled();
  controller.stop();
});
