import { resolveDeviceMapping } from "../../src/mapping/device-resolver";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";

interface Fixture {
  description: DeviceDescription;
  channels: {
    description: DeviceDescription;
    parameters: ParamsetDescription;
  }[];
}
async function discover(model: string, mutate?: (fixture: Fixture) => void) {
  const fixture = JSON.parse(
    readFileSync(`tests/fixtures/additional-devices/${model}.json`, "utf8"),
  ) as Fixture;
  mutate?.(fixture);
  const client = {
    listDevices: vi
      .fn()
      .mockResolvedValue([
        fixture.description,
        ...fixture.channels.map((c) => c.description),
      ]),
    getParamsetDescription: vi.fn((address: string) =>
      Promise.resolve(
        fixture.channels.find((c) => c.description.ADDRESS === address)
          ?.parameters ?? {},
      ),
    ),
    getValue: vi.fn().mockResolvedValue(false),
    getParamset: vi.fn((address: string) =>
      Promise.resolve(
        Object.fromEntries(
          Object.entries(
            fixture.channels.find((c) => c.description.ADDRESS === address)
              ?.parameters ?? {},
          )
            .filter(([, p]) => (p.OPERATIONS & 1) !== 0)
            .map(([key, p]) => [
              key,
              p.TYPE === "BOOL" ? false : key === "ACTIVITY_STATE" ? 3 : 0.25,
            ]),
        ),
      ),
    ),
    setValue: vi.fn().mockResolvedValue(undefined),
    putParamset: vi.fn().mockResolvedValue(undefined),
    init: vi.fn(),
  } satisfies XmlRpcClient;
  const interfaceId = model === "HM-PB-2-FM" ? "BidCos-RF" : "HmIP-RF";
  const runtime = new OpenCcuRuntime(client, {
    centralId: "test",
    interfaceId,
  });
  await runtime.refresh();
  runtime.publishConnectionState("healthy");
  return {
    runtime,
    client,
    candidates: runtime.pairingCandidates(),
    address: fixture.description.ADDRESS,
    interfaceId,
  };
}

describe("additional forum devices through XML-RPC discovery", () => {
  it("reuses BROLL readback and writes only channel 4 including stop", async () => {
    const { runtime, client, candidates, address } =
      await discover("HmIP-BROLL-2");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].driverId).toBe("HmIP-BROLL");
    const level = candidates[0].store.bindings.find(
      (b) => b.capability === "windowcoverings_set",
    )!;
    const state = candidates[0].store.bindings.find(
      (b) => b.capability === "windowcoverings_state",
    )!;
    expect(level.channelAddress).toBe(`${address}:3`);
    await runtime.write(level, 0.6);
    expect(client.setValue).toHaveBeenLastCalledWith(
      `${address}:4`,
      "LEVEL",
      0.6,
      undefined,
    );
    await runtime.write(state, "idle");
    expect(client.setValue).toHaveBeenLastCalledWith(
      `${address}:4`,
      "STOP",
      true,
      undefined,
    );
  });

  it("retains SWDO-2 in the existing contact family", async () => {
    const { candidates } = await discover("HmIP-SWDO-2");
    expect(candidates[0].driverId).toBe("HMIP-SWDO");
    expect(candidates[0].capabilities).toContain("alarm_contact");
  });

  it("exposes twelve FALMOT valves with stable identities and rejects valve writes even with overbroad metadata", async () => {
    const { runtime, client, candidates, address } = await discover(
      "HmIP-FALMOT-C12",
      (fixture) => {
        fixture.channels[0].parameters = {
          ...fixture.channels[0].parameters,
          LEVEL: { TYPE: "FLOAT", FLAGS: 1, OPERATIONS: 7 },
        };
      },
    );
    expect(candidates).toHaveLength(12);
    expect(new Set(candidates.map((c) => c.data.id)).size).toBe(12);
    for (const candidate of candidates) {
      expect(candidate.capabilities).not.toContain("dim");
      expect(candidate.store.bindings.every((b) => !b.writable)).toBe(true);
      const valve = candidate.store.bindings.find(
        (b) => b.capability === "homematic_measure_valve",
      )!;
      expect(await runtime.read(valve)).toBe(25);
      await expect(runtime.write(valve, 70)).rejects.toThrow("not writable");
    }
    const candidate = candidates.find((c) => c.data.logicalId === "valve-12")!;
    expect(candidate.store.bindings[0].channelAddress).toBe(`${address}:12`);
    expect(client.setValue).not.toHaveBeenCalled();
  });

  it("separates MIOB physical outputs, inputs and analog output without exposing virtual duplicates", async () => {
    const { runtime, client, candidates, address } =
      await discover("HmIP-MIOB");
    expect(candidates).toHaveLength(5);
    for (const [id, read, write] of [
      ["output-1", 1, 2],
      ["output-2", 5, 6],
    ] as const) {
      const binding = candidates.find((c) => c.data.logicalId === id)!.store
        .bindings[0];
      expect(binding.channelAddress).toBe(`${address}:${read}`);
      await runtime.write(binding, true);
      expect(client.setValue).toHaveBeenLastCalledWith(
        `${address}:${write}`,
        "STATE",
        true,
        undefined,
      );
    }
    for (const candidate of candidates.filter((c) =>
      c.data.logicalId?.startsWith("input-"),
    )) {
      await expect(
        runtime.write(candidate.store.bindings[0], true),
      ).rejects.toThrow("not writable");
    }
    const analog = candidates.find((c) => c.data.logicalId === "analog-output")!
      .store.bindings[0];
    await runtime.write(analog, 0.4);
    expect(client.setValue).toHaveBeenLastCalledWith(
      `${address}:11`,
      "LEVEL",
      0.4,
      undefined,
    );
  });

  it("omits unavailable MIOB outputs instead of claiming unsupported control", async () => {
    const { candidates } = await discover("HmIP-MIOB", (fixture) => {
      for (const channel of fixture.channels) {
        if (channel.description.TYPE === "SWITCH_VIRTUAL_RECEIVER")
          channel.parameters = {};
        if (channel.description.TYPE === "ANALOG_OUTPUT_TRANSCEIVER")
          channel.parameters = {
            LEVEL: { TYPE: "FLOAT", FLAGS: 1, OPERATIONS: 5 },
          };
      }
    });
    expect(candidates.map((c) => c.data.logicalId).sort()).toEqual([
      "input-1",
      "input-2",
    ]);
  });

  it("delivers both classic button short/long callbacks through the production Homey controller without writing button actions", async () => {
    const { runtime, client, candidates, address, interfaceId } =
      await discover("HM-PB-2-FM");
    const candidate = candidates[0];
    expect(candidate.data.id).toContain("/BidCos-RF/");
    const values = new Map<string, RpcValue>();
    const triggerButtonEvent = vi.fn().mockResolvedValue(undefined);
    const onCapabilityWrite = vi.fn(() => () => undefined);
    const controller = new DeviceBindingController(
      runtime,
      {
        getCapabilities: () => candidate.capabilities,
        addCapability: vi.fn(),
        removeCapability: vi.fn(),
        setCapabilityValue: (id, value) => {
          values.set(id, value);
          return Promise.resolve();
        },
        triggerButtonEvent,
        onCapabilityWrite,
        setAvailable: vi.fn(),
        setUnavailable: vi.fn(),
        log: vi.fn(),
        error: vi.fn(),
      },
      candidate.store.bindings,
      { resolveButtonEvents: () => candidate.mapping.buttonEvents },
    );
    try {
      await controller.start();
      expect(values.get("alarm_battery")).toBe(false);
      for (const button of [1, 2])
        for (const [parameter, pressType] of [
          ["PRESS_SHORT", "short"],
          ["PRESS_LONG", "long"],
        ]) {
          await runtime
            .createCallbackDispatcher()
            .dispatch("event", [
              interfaceId,
              `${address}:${button}`,
              parameter,
              true,
            ]);
          expect(triggerButtonEvent).toHaveBeenLastCalledWith(
            button,
            pressType,
          );
        }
      expect(triggerButtonEvent).toHaveBeenCalledTimes(4);
      expect(onCapabilityWrite).not.toHaveBeenCalled();
      expect(client.setValue).not.toHaveBeenCalled();
    } finally {
      controller.stop();
    }
  });
});

it("preserves already paired generic parents when a model gains logical outputs", async () => {
  const { runtime, address } = await discover("HmIP-MIOB");
  const device = runtime.devices.get(address)!;
  expect(() => resolveDeviceMapping(device)).toThrow("logical device identity");
  expect(
    resolveDeviceMapping(device, undefined, undefined, true),
  ).toMatchObject({ driverId: "openccu-generic", generic: true });
  expect(
    resolveDeviceMapping(device, undefined, "output-1", true),
  ).toMatchObject({
    driverId: "HmIP-MIOB",
    generic: false,
    logicalId: "output-1",
  });
});
