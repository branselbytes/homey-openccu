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
  const client: XmlRpcClient = {
    listDevices: vi.fn(),
    getParamsetDescription: vi.fn(),
    getValue: vi.fn().mockResolvedValue(1),
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
    error: vi.fn(),
  };
  return {
    runtime,
    device,
    setValue,
    setCapabilityValue,
    getWriteListener: () => writeListener,
  };
}

describe("DeviceBindingController", () => {
  it("reconciles capabilities, reads initial state, writes to command targets, and routes events", async () => {
    const { runtime, device, setValue, setCapabilityValue, getWriteListener } =
      fixture();
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
  });
});
