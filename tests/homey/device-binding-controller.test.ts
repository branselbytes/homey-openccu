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
  const client: XmlRpcClient = {
    listDevices: vi.fn(),
    getParamsetDescription: vi.fn(),
    getValue,
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
  const device = {
    getCapabilities: () => ["old_capability"],
    addCapability: vi.fn().mockResolvedValue(undefined),
    removeCapability: vi.fn().mockResolvedValue(undefined),
    setCapabilityValue,
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
    getValue,
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
    expect(device.log).toHaveBeenNthCalledWith(
      1,
      "Writing onoff to 301:4/STATE",
    );
    expect(device.log).toHaveBeenNthCalledWith(
      2,
      "Wrote onoff to 301:4/STATE",
    );
  });

  it("logs a failed write without logging its value and rethrows it", async () => {
    const { runtime, device, setValue, getWriteListener } = fixture();
    const failure = new Error("XML-RPC timeout");
    setValue.mockRejectedValueOnce(failure);
    const controller = new DeviceBindingController(runtime, device, [binding]);

    await controller.start();
    await expect(getWriteListener()?.(false)).rejects.toThrow("XML-RPC timeout");

    expect(device.log).toHaveBeenCalledWith("Writing onoff to 301:4/STATE");
    expect(device.error).toHaveBeenCalledWith(
      "Failed to write onoff to 301:4/STATE",
      failure,
    );
    expect(device.log).not.toHaveBeenCalledWith(expect.stringContaining("false"));
  });

  it("acknowledges a slow write to Homey while awaiting OpenCCU confirmation", async () => {
    vi.useFakeTimers();
    try {
      const { runtime, device, setValue, getValue, getWriteListener } = fixture();
      let confirmWrite: (() => void) | undefined;
      setValue.mockImplementationOnce(
        () => new Promise<void>((resolve) => { confirmWrite = resolve; }),
      );
      const controller = new DeviceBindingController(runtime, device, [binding]);
      await controller.start();

      const write = getWriteListener()?.(false);
      await vi.advanceTimersByTimeAsync(1_500);
      await expect(write).resolves.toBeUndefined();
      expect(device.log).toHaveBeenCalledWith(
        "Accepted onoff write to 301:4/STATE; awaiting OpenCCU confirmation",
      );

      confirmWrite?.();
      getValue.mockResolvedValueOnce(false);
      await vi.advanceTimersByTimeAsync(3_000);
      await vi.waitFor(() =>
        expect(device.log).toHaveBeenCalledWith(
          "Verified onoff from OpenCCU",
        ),
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
      "Waiting for OpenCCU HmIP-RF connection",
    );

    runtime.publishConnectionState("healthy");
    await vi.waitFor(() => expect(setCapabilityValue).toHaveBeenCalledOnce());
    expect(device.setAvailable).toHaveBeenCalledOnce();
  });
});
