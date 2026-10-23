import { ManagedCentralRuntimeFactory } from "../../src/runtime/managed-central-runtime";
import { parseOpenCcuSettings } from "../../src/config/openccu-config";
import { ProtocolError } from "../../src/protocol/errors";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";
import { resolveDeviceMapping } from "../../src/mapping/device-resolver";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";

function fixture(file: string, interfaceId = "HmIP-RF") {
  const recording = JSON.parse(readFileSync(file, "utf8")) as {
    description: DeviceDescription;
    channels: {
      description: DeviceDescription;
      parameters: ParamsetDescription;
    }[];
  };
  // Synthetic maintenance channel supplements the recorded handle metadata.
  if (recording.description.TYPE === "HmIP-SRH") {
    recording.description = {
      ...recording.description,
      CHILDREN: ["HANDLE1:0", "HANDLE1:1"],
    };
    recording.channels.push({
      description: {
        ADDRESS: "HANDLE1:0",
        TYPE: "MAINTENANCE",
        PARENT: "HANDLE1",
        PARAMSETS: ["VALUES"],
      },
      parameters: { LOW_BAT: { TYPE: "BOOL", OPERATIONS: 5, FLAGS: 1 } },
    });
  }
  const client = {
    listDevices: vi
      .fn()
      .mockResolvedValue([
        recording.description,
        ...recording.channels.map((c) => c.description),
      ]),
    getParamsetDescription: vi.fn((address: string) =>
      Promise.resolve(
        recording.channels.find((c) => c.description.ADDRESS === address)
          ?.parameters ?? {},
      ),
    ),
    getParamset: vi.fn().mockResolvedValue({
      STATE: 0,
      LEVEL: 0,
      ACTIVITY_STATE: 0,
      LOW_BAT: false,
    }),
    getValue: vi.fn(),
    setValue: vi.fn().mockResolvedValue(undefined),
    putParamset: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
  } satisfies XmlRpcClient;
  const runtime = new OpenCcuRuntime(client, {
    centralId: "fixture",
    interfaceId,
  });
  const address = recording.description.ADDRESS;
  const resolve = () => {
    const found = runtime.devices.get(address);
    return found ? resolveDeviceMapping(found).bindings : undefined;
  };
  const capabilities = new Set<string>();
  const listeners = new Map<string, (value: RpcValue) => Promise<void>>();
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
    onCapabilityWrite: (
      id: string,
      listener: (value: RpcValue) => Promise<void>,
    ) => {
      listeners.set(id, listener);
      return () => listeners.delete(id);
    },
    setAvailable: vi.fn().mockResolvedValue(undefined),
    setUnavailable: vi.fn().mockResolvedValue(undefined),
    setWarning: vi.fn().mockResolvedValue(undefined),
    unsetWarning: vi.fn().mockResolvedValue(undefined),
    triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
  };
  const persistBindings = vi.fn().mockResolvedValue(undefined);
  const options = {
    resolveBindings: resolve,
    isMappingComplete: () =>
      runtime.devices.get(address)?.discoveryComplete === true,
    persistBindings,
  };
  return {
    recording,
    runtime,
    client,
    address,
    resolve,
    capabilities,
    listeners,
    device,
    options,
    persistBindings,
  };
}
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

it.each([false, true])(
  "routes Flow-style cover commands only to HmIP with Classic=%s, even after read failures",
  async (enableBidCosRf) => {
    vi.useFakeTimers();
    const f = fixture("tests/fixtures/additional-devices/HmIP-BROLL-2.json");
    const classic = {
      ...f.client,
      listDevices: vi.fn().mockResolvedValue([]),
      setValue: vi.fn().mockResolvedValue(undefined),
    };
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: "192.0.2.20",
      createClient: () => f.client,
      createBidCosRfClient: () => classic,
      createCallbackServer: () => ({
        ready: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const managed = await factory.create(
      parseOpenCcuSettings({
        centralId: "fixture",
        host: "openccu.local",
        enableBidCosRf,
      }),
    );
    let controller: DeviceBindingController | undefined;
    try {
      await flush();
      const core = managed.core;
      expect(core.connectionState).toBe("healthy");
      expect(managed.getCore("BidCos-RF")?.connectionState).toBe(
        enableBidCosRf ? "healthy" : undefined,
      );
      const bindings = resolveDeviceMapping(
        core.devices.get(f.address)!,
      ).bindings;
      controller = new DeviceBindingController(core, f.device, bindings);
      await controller.start();
      expect(f.device.error).not.toHaveBeenCalled();
      expect(f.device.setCapabilityValue).toHaveBeenCalledWith(
        "windowcoverings_state",
        "idle",
      );
      expect(
        await core.read(
          bindings.find((b) => b.capability === "windowcoverings_state")!,
        ),
      ).toBe("idle");
      f.client.getParamset.mockRejectedValue(
        new ProtocolError("remote-fault", "synthetic", undefined, -2),
      );
      await f.listeners.get("windowcoverings_state")!("up");
      await vi.advanceTimersByTimeAsync(33_000);
      expect(f.device.setUnavailable).toHaveBeenCalledWith(
        "OpenCCU command delivery could not be verified",
      );
      await core
        .createCallbackDispatcher()
        .dispatch("event", [
          "HmIP-RF",
          "TESTHMIPBROLL2:3",
          "ACTIVITY_STATE",
          2,
        ]);
      await flush();
      expect(f.device.setCapabilityValue).toHaveBeenCalledWith(
        "windowcoverings_state",
        "down",
      );
      expect(f.device.setAvailable).toHaveBeenCalledTimes(2);
      await f.listeners.get("windowcoverings_state")!("down");
      expect(f.client.setValue).toHaveBeenCalledTimes(2);
      expect(f.client.setValue).toHaveBeenNthCalledWith(
        1,
        "TESTHMIPBROLL2:4",
        "LEVEL",
        1,
        undefined,
      );
      expect(f.client.setValue).toHaveBeenNthCalledWith(
        2,
        "TESTHMIPBROLL2:4",
        "LEVEL",
        0,
        undefined,
      );
      expect(classic.setValue).not.toHaveBeenCalled();
    } finally {
      controller?.stop();
      await managed.stop();
      vi.useRealTimers();
    }
  },
);
