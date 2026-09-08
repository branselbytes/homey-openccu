import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import { resolveDeviceMapping } from "../../src/mapping/device-resolver";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";

interface RecordedDevice {
  type: string;
  address: string;
  channels: {
    index: number;
    type: string;
    parameters: ParamsetDescription;
    mode?: number;
    modes?: string[];
  }[];
}
const recorded = JSON.parse(
  readFileSync("tests/fixtures/wired-devices.json", "utf8"),
) as RecordedDevice[];
function fixture() {
  const modes = new Map(
    Array.from({ length: 16 }, (_, i) => [`WIRED2:${i + 1}`, i < 3 ? 3 : 1]),
  );
  const channels = new Map<string, RecordedDevice["channels"][number]>(
    recorded.flatMap((d) =>
      d.channels.map((c) => [`${d.address}:${c.index}`, c] as const),
    ),
  );
  const setValue = vi.fn();
  const client: XmlRpcClient = {
    listDevices: vi.fn().mockResolvedValue(
      recorded.flatMap((d) => [
        {
          ADDRESS: d.address,
          TYPE: d.type,
          PARENT: "",
          CHILDREN: d.channels.map((c) => `${d.address}:${c.index}`),
          PARAMSETS: ["MASTER"],
        },
        ...d.channels.map((c) => ({
          ADDRESS: `${d.address}:${c.index}`,
          TYPE: c.type,
          INDEX: c.index,
          PARENT: d.address,
          PARAMSETS: ["VALUES", "MASTER"],
        })),
      ]),
    ),
    getParamsetDescription: vi.fn<XmlRpcClient["getParamsetDescription"]>(
      (address, key) =>
        Promise.resolve<ParamsetDescription>(
          key === "VALUES"
            ? channels.get(address)!.parameters
            : {
                CHANNEL_OPERATION_MODE: {
                  TYPE: "ENUM",
                  OPERATIONS: 3,
                  FLAGS: 1,
                  VALUE_LIST: channels.get(address)!.modes,
                },
              },
        ),
    ),
    getParamset: vi.fn<XmlRpcClient["getParamset"]>((address, key) =>
      Promise.resolve<Readonly<Record<string, RpcValue>>>(
        key === "MASTER"
          ? { CHANNEL_OPERATION_MODE: modes.get(address)! }
          : { STATE: false },
      ),
    ),
    getValue: vi.fn().mockResolvedValue(false),
    setValue,
    putParamset: vi.fn(),
    init: vi.fn(),
  };
  const runtime = new OpenCcuRuntime(client, {
    centralId: "test",
    interfaceId: "HmIP-RF",
  });
  return { runtime, client, modes, setValue };
}

describe("recorded Wired device discovery", () => {
  it("pairs eight outputs with physical feedback and separate write targets", async () => {
    const { runtime, setValue } = fixture();
    await runtime.refresh();
    const outputs = runtime
      .pairingCandidates()
      .filter((c) => c.driverId === "HmIPW-DRS8");
    expect(outputs).toHaveLength(8);
    for (let i = 1; i <= 8; i++) {
      const candidate = outputs.find(
        (c) => c.data.logicalId === `output-${i}`,
      )!;
      expect(candidate.mapping.bindings).toEqual([
        expect.objectContaining({
          capability: "onoff",
          channelAddress: `WIRED1:${4 * i - 3}`,
          writeChannelAddress: `WIRED1:${4 * i - 2}`,
          writable: true,
        }),
      ]);
      await runtime.write(candidate.mapping.bindings[0], true);
      expect(setValue).toHaveBeenLastCalledWith(
        `WIRED1:${4 * i - 2}`,
        "STATE",
        true,
        undefined,
      );
    }
  });
  it("resolves every input by its configured mode, preserving identity across switches", async () => {
    const { runtime, modes } = fixture();
    await runtime.refresh();
    expect(
      runtime.pairingCandidates().filter((c) => c.driverId === "HmIPW-DRI16"),
    ).toHaveLength(16);
    for (const mode of [3, 1, 2, 0, 99]) {
      for (let i = 1; i <= 16; i++) modes.set(`WIRED2:${i}`, mode);
      await runtime.refresh();
      for (let i = 1; i <= 16; i++) {
        const mapping = resolveDeviceMapping(
          runtime.devices.get("WIRED2")!,
          undefined,
          `input-${i}`,
        );
        expect(mapping.logicalId).toBe(`input-${i}`);
        expect(mapping.bindings).toHaveLength(mode === 3 ? 1 : 0);
        expect(mapping.buttonEvents).toHaveLength(
          mode === 1 || mode === 2 ? 2 : 0,
        );
        if (mode === 3)
          expect(mapping.bindings[0]).toMatchObject({
            capability: "alarm_contact",
            channelAddress: `WIRED2:${i}`,
            writable: false,
          });
        for (const event of mapping.buttonEvents) expect(event.button).toBe(i);
      }
    }
  });
  it("updates a paired input after an OpenCCU updateDevice callback and stops old events", async () => {
    const { runtime, modes } = fixture();
    await runtime.refresh();
    runtime.publishConnectionState("healthy");
    const capabilities = new Set<string>();
    const device = {
      getCapabilities: () => [...capabilities],
      addCapability: vi.fn((c: string) => {
        capabilities.add(c);
        return Promise.resolve();
      }),
      removeCapability: vi.fn(async (c: string) => {
        capabilities.delete(c);
        return Promise.resolve();
      }),
      setCapabilityValue: vi.fn().mockResolvedValue(undefined),
      triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
      onCapabilityWrite: vi.fn(),
      setAvailable: vi.fn(),
      setUnavailable: vi.fn(),
      log: vi.fn(),
      error: vi.fn(),
    };
    const mapping = () =>
      resolveDeviceMapping(
        runtime.devices.get("WIRED2")!,
        undefined,
        "input-1",
      );
    const controller = new DeviceBindingController(runtime, device, [], {
      resolveBindings: () => mapping().bindings,
      resolveButtonEvents: () => mapping().buttonEvents,
    });
    await controller.start();
    expect(capabilities.has("alarm_contact")).toBe(true);
    const dispatcher = runtime.createCallbackDispatcher();
    modes.set("WIRED2:1", 1);
    await dispatcher.dispatch("updateDevice", ["HmIP-RF", "WIRED2:1", 0]);
    await vi.waitFor(() =>
      expect(capabilities.has("alarm_contact")).toBe(false),
    );
    await dispatcher.dispatch("event", [
      "HmIP-RF",
      "WIRED2:1",
      "PRESS_SHORT",
      true,
    ]);
    expect(device.triggerButtonEvent).toHaveBeenCalledWith(1, "short");
    modes.set("WIRED2:1", 3);
    await dispatcher.dispatch("updateDevice", ["HmIP-RF", "WIRED2:1", 0]);
    await vi.waitFor(() =>
      expect(capabilities.has("alarm_contact")).toBe(true),
    );
    device.triggerButtonEvent.mockClear();
    await dispatcher.dispatch("event", [
      "HmIP-RF",
      "WIRED2:1",
      "PRESS_SHORT",
      true,
    ]);
    expect(device.triggerButtonEvent).not.toHaveBeenCalled();
    await dispatcher.dispatch("event", ["HmIP-RF", "WIRED2:1", "STATE", true]);
    expect(device.setCapabilityValue).toHaveBeenLastCalledWith(
      "alarm_contact",
      true,
    );
    expect(device.onCapabilityWrite).not.toHaveBeenCalled();
    controller.stop();
  });
});
