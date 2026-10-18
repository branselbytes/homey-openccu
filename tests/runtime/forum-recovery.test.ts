import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";
import { resolveDeviceMapping } from "../../src/mapping/device-resolver";
import type { CapabilityBinding } from "../../src/mapping/types";
import type { XmlRpcClient } from "../../src/protocol/xmlrpc/types";
import { ManagedCentralRuntimeFactory } from "../../src/runtime/managed-central-runtime";
import { parseOpenCcuSettings } from "../../src/config/openccu-config";

const handle: CapabilityBinding = {
  capability: "homematic_rhs_state",
  channelAddress: "HANDLE:1",
  parameter: "STATE",
  readable: true,
  writable: false,
  transform: "enum-number-to-string",
};
const battery: CapabilityBinding = {
  capability: "alarm_battery",
  channelAddress: "HANDLE:0",
  parameter: "LOW_BAT",
  readable: true,
  writable: false,
  transform: "boolean",
};
const shutter: CapabilityBinding = {
  capability: "windowcoverings_set",
  channelAddress: "SHUTTER:3",
  parameter: "LEVEL",
  writeChannelAddress: "SHUTTER:4",
  writeParameter: "LEVEL",
  readable: true,
  writable: true,
  transform: "identity",
};

function fixture(bindings: readonly CapabilityBinding[]) {
  const capabilities = new Set(bindings.map((b) => b.capability));
  const writes = new Map<string, (value: number) => Promise<void>>();
  const client = {
    listDevices: vi.fn().mockResolvedValue([
      {
        ADDRESS: "HANDLE",
        TYPE: "HmIP-SRH",
        CHILDREN: ["HANDLE:0", "HANDLE:1"],
      },
      {
        ADDRESS: "HANDLE:0",
        TYPE: "MAINTENANCE",
        PARENT: "HANDLE",
        PARAMSETS: ["VALUES"],
      },
      {
        ADDRESS: "HANDLE:1",
        TYPE: "SHUTTER_CONTACT",
        PARENT: "HANDLE",
        PARAMSETS: ["VALUES"],
      },
    ]),
    getParamsetDescription: vi.fn().mockRejectedValue(new Error("timeout")),
    getParamset: vi
      .fn()
      .mockResolvedValue({ STATE: 0, LOW_BAT: false, LEVEL: 1 }),
    getValue: vi.fn(),
    setValue: vi.fn().mockResolvedValue(undefined),
    putParamset: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
  } satisfies XmlRpcClient;
  const runtime = new OpenCcuRuntime(client, {
    centralId: "ccu",
    interfaceId: "HmIP-RF",
  });
  const device = {
    getCapabilities: () => [...capabilities],
    addCapability: vi.fn((id: string) => {
      capabilities.add(id);
      return Promise.resolve();
    }),
    removeCapability: vi.fn((id: string) => {
      capabilities.delete(id);
      return Promise.resolve();
    }),
    setCapabilityValue: vi.fn().mockResolvedValue(undefined),
    triggerButtonEvent: vi.fn(),
    onCapabilityWrite: vi.fn(
      (id: string, listener: (value: number) => Promise<void>) => {
        writes.set(id, listener);
        return () => {
          writes.delete(id);
        };
      },
    ),
    setAvailable: vi.fn().mockResolvedValue(undefined),
    setUnavailable: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
  };
  return { runtime, device, client, writes };
}

function restoreDescriptions(client: ReturnType<typeof fixture>["client"]) {
  vi.mocked(client.getParamsetDescription).mockImplementation(
    (address: string) =>
      Promise.resolve(
        address.endsWith(":0")
          ? { LOW_BAT: { TYPE: "BOOL", OPERATIONS: 5, FLAGS: 1 } }
          : {
              STATE: {
                TYPE: "ENUM",
                OPERATIONS: 5,
                FLAGS: 1,
                VALUE_LIST: ["CLOSED", "TILTED", "OPEN"],
              },
            },
      ),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("forum #19: partial discovery must not remove existing Homey functions", () => {
  it("retains the handle, battery and stored mapping, then repairs them on the scheduled retry", async () => {
    vi.useFakeTimers();
    const { runtime, device, client } = fixture([handle, battery]);
    await runtime.refresh();
    runtime.publishConnectionState("healthy");
    const persist = vi.fn();
    const controller = new DeviceBindingController(
      runtime,
      device,
      [handle, battery],
      {
        isMappingComplete: () =>
          runtime.devices.get("HANDLE")?.discoveryComplete === true,
        resolveBindings: () =>
          resolveDeviceMapping(runtime.devices.get("HANDLE")!).bindings,
        persistBindings: persist,
      },
    );
    await controller.start();
    expect(device.getCapabilities()).toEqual([
      handle.capability,
      battery.capability,
    ]);
    expect(device.removeCapability).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
    expect(runtime.pairingCandidates()).toEqual([]);
    restoreDescriptions(client);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(runtime.devices.get("HANDLE")?.discoveryComplete).toBe(true);
    expect(runtime.pairingCandidates()).toHaveLength(1);
    expect(persist).not.toHaveBeenCalled();
    expect(device.getCapabilities()).toEqual(
      expect.arrayContaining([handle.capability, battery.capability]),
    );
    controller.stop();
    runtime.publishConnectionState("stopped");
  });

  it("restores capabilities already lost in an earlier version without re-pairing", async () => {
    vi.useFakeTimers();
    const { runtime, device, client } = fixture([]);
    await runtime.refresh();
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, device, [], {
      isMappingComplete: () =>
        runtime.devices.get("HANDLE")?.discoveryComplete === true,
      resolveBindings: () =>
        resolveDeviceMapping(runtime.devices.get("HANDLE")!).bindings,
    });
    await controller.start();
    restoreDescriptions(client);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(device.getCapabilities()).toEqual(
      expect.arrayContaining([handle.capability, battery.capability]),
    );
    expect(device.setCapabilityValue).toHaveBeenCalledWith(
      "homematic_rhs_state",
      "0",
    );
    controller.stop();
    runtime.publishConnectionState("stopped");
  });

  it("keeps HmIP capabilities when classic discovery fails and stops its retry work", async () => {
    const { client, device } = fixture([handle, battery]);
    restoreDescriptions(client);
    const classic = fixture([]).client;
    vi.mocked(classic.listDevices).mockRejectedValue(
      new Error("classic unavailable"),
    );
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: "192.0.2.20",
      createClient: () => client,
      createBidCosRfClient: () => classic,
      createCallbackServer: () => ({
        ready: async () => {},
        close: async () => {},
      }),
    });
    const managed = await factory.create(
      parseOpenCcuSettings({
        centralId: "ccu",
        host: "192.0.2.10",
        enableBidCosRf: true,
      }),
    );
    await vi.waitFor(() =>
      expect(managed.core.connectionState).toBe("healthy"),
    );
    const controller = new DeviceBindingController(
      managed.core,
      device,
      [handle, battery],
      {
        isMappingComplete: () =>
          managed.core.devices.get("HANDLE")?.discoveryComplete === true,
        resolveBindings: () =>
          resolveDeviceMapping(managed.core.devices.get("HANDLE")!).bindings,
      },
    );
    await controller.start();
    expect(managed.getCore("BidCos-RF")?.connectionState).toBe("disconnected");
    expect(device.getCapabilities()).toEqual(
      expect.arrayContaining([handle.capability, battery.capability]),
    );
    controller.stop();
    await managed.stop();
  });

  it("does not retry incomplete discovery after shutdown", async () => {
    vi.useFakeTimers();
    const { runtime, client } = fixture([]);
    await runtime.refresh();
    runtime.publishConnectionState("stopped");
    await vi.advanceTimersByTimeAsync(600_000);
    expect(client.listDevices).toHaveBeenCalledOnce();
  });
});

describe("forum #20: recovery after a failed shutter command read-back", () => {
  it.each(["callback", "read"])(
    "restores availability through %s without replaying the command",
    async (method) => {
      vi.useFakeTimers();
      const { runtime, device, client, writes } = fixture([shutter]);
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(runtime, device, [
        shutter,
      ]);
      await controller.start();
      vi.mocked(client.getParamset).mockRejectedValue(
        new Error("read timeout"),
      );
      await writes.get(shutter.capability)!(0);
      await vi.advanceTimersByTimeAsync(33_000);
      expect(device.setUnavailable).toHaveBeenCalledWith(
        "OpenCCU command delivery could not be verified",
      );
      device.setAvailable.mockClear();
      if (method === "callback") {
        await runtime
          .createCallbackDispatcher()
          .dispatch("event", ["HmIP-RF", "UNRELATED:3", "LEVEL", 0]);
        expect(device.setAvailable).not.toHaveBeenCalled();
        await runtime
          .createCallbackDispatcher()
          .dispatch("event", ["HmIP-RF", "SHUTTER:3", "LEVEL", 0]);
      } else {
        // Availability is communication health, not proof that the old command succeeded.
        vi.mocked(client.getParamset).mockResolvedValue({ LEVEL: 0.5 });
        await vi.advanceTimersByTimeAsync(30_000);
        expect(device.setCapabilityValue).toHaveBeenCalledWith(
          shutter.capability,
          0.5,
        );
      }
      expect(device.setAvailable).toHaveBeenCalledOnce();
      expect(client.setValue).toHaveBeenCalledTimes(1);
      controller.stop();
    },
  );

  it.each(["stop", "new command"])(
    "ignores a late failed verification after %s",
    async (action) => {
      vi.useFakeTimers();
      const { runtime, device, client, writes } = fixture([shutter]);
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(runtime, device, [
        shutter,
      ]);
      await controller.start();
      vi.mocked(client.getParamset).mockRejectedValue(
        new Error("read timeout"),
      );
      await writes.get(shutter.capability)!(0);
      await vi.advanceTimersByTimeAsync(13_000);
      let rejectRead!: (error: Error) => void;
      vi.mocked(client.getParamset).mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectRead = reject;
          }),
      );
      await vi.advanceTimersByTimeAsync(20_000);
      if (action === "stop") controller.stop();
      else await writes.get(shutter.capability)!(1);
      rejectRead(new Error("late timeout"));
      await vi.advanceTimersByTimeAsync(0);
      expect(device.setUnavailable).not.toHaveBeenCalled();
      controller.stop();
    },
  );

  it("cancels recovery reads on shutdown", async () => {
    vi.useFakeTimers();
    const { runtime, device, client, writes } = fixture([shutter]);
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, device, [shutter]);
    await controller.start();
    vi.mocked(client.getParamset).mockRejectedValue(new Error("read timeout"));
    await writes.get(shutter.capability)!(0);
    await vi.advanceTimersByTimeAsync(33_000);
    controller.stop();
    const reads = vi.mocked(client.getParamset).mock.calls.length;
    device.setAvailable.mockClear();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(client.getParamset).toHaveBeenCalledTimes(reads);
    expect(device.setAvailable).not.toHaveBeenCalled();
  });
});
