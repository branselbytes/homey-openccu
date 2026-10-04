import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  DeviceBindingController,
  type HomeyDevicePort,
} from "../../src/homey/device-binding-controller";
import { parseStoredBindings } from "../../src/homey/stored-bindings";
import type { CapabilityBinding } from "../../src/mapping/types";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";

interface Recording {
  readonly description: DeviceDescription;
  readonly channels: readonly {
    readonly description: DeviceDescription;
    readonly parameters: ParamsetDescription;
  }[];
}

// Recorded metadata comes from issue #1. Values, callbacks and command replies
// are simulated; these tests do not claim a physical motor has been exercised.
const recording = JSON.parse(
  readFileSync("tests/fixtures/hoermann-mod-ho.json", "utf8"),
) as Recording;

async function fixture() {
  const address = recording.description.ADDRESS;
  const paramsets = new Map(
    recording.channels.map(({ description, parameters }) => [
      description.ADDRESS,
      parameters,
    ]),
  );
  const values = new Map<string, Record<string, RpcValue>>([
    [`${address}:1`, { DOOR_STATE: "CLOSED", SECTION: 0 }],
    [`${address}:2`, { STATE: false }],
  ]);
  const client = {
    listDevices: vi
      .fn()
      .mockResolvedValue([
        recording.description,
        ...recording.channels.map(({ description }) => description),
      ]),
    getParamsetDescription: vi.fn((channel: string) =>
      Promise.resolve(paramsets.get(channel) ?? {}),
    ),
    getParamset: vi.fn((channel: string) =>
      Promise.resolve(values.get(channel) ?? {}),
    ),
    getValue: vi.fn(),
    setValue: vi.fn().mockResolvedValue(undefined),
    putParamset: vi.fn(),
    init: vi.fn(),
  } satisfies XmlRpcClient;
  const runtime = new OpenCcuRuntime(client, {
    centralId: "fixture",
    interfaceId: "HmIP-RF",
  });
  await runtime.refresh();
  const candidate = runtime.pairingCandidates()[0];
  const bindings = candidate.store.bindings;
  function binding(capability: string): CapabilityBinding {
    const result = bindings.find(
      (binding) => binding.capability === capability,
    );
    if (!result) throw new Error(`Missing fixture capability ${capability}`);
    return result;
  }
  return { address, client, values, runtime, candidate, bindings, binding };
}

function homeyPort(initialCapabilities = ["garagedoor_closed", "onoff"]) {
  const capabilities = new Set(initialCapabilities);
  const listeners = new Map<string, (value: RpcValue) => Promise<void>>();
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
    setCapabilityValue: vi.fn().mockResolvedValue(undefined),
    triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
    onCapabilityWrite: vi.fn(
      (capability: string, listener: (value: RpcValue) => Promise<void>) => {
        listeners.set(capability, listener);
        return () => listeners.delete(capability);
      },
    ),
    setAvailable: vi.fn().mockResolvedValue(undefined),
    setUnavailable: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
  } satisfies HomeyDevicePort;
  async function write(capability: string, value: RpcValue): Promise<void> {
    const listener = listeners.get(capability);
    if (!listener) throw new Error(`No listener for ${capability}`);
    await listener(value);
  }
  return { device, write };
}

describe("recorded HmIP-MOD-HO discovery, controls and upgrade", () => {
  it("preserves the pairing identity and maps the reported door and light channels", async () => {
    const { address, runtime, candidate, binding, bindings } = await fixture();
    expect(runtime.discoveryIssues).toEqual([]);
    expect(runtime.pairingCandidates()).toHaveLength(1);
    expect(candidate).toMatchObject({
      driverId: "HmIP-MOD-HO",
      data: { id: `fixture/HmIP-RF/${address}`, address },
      store: { profileId: "hmip-mod-ho", generic: false },
    });
    expect(candidate.capabilities).toEqual([
      "garagedoor_closed",
      "onoff",
      "homematic_garage_state",
      "homematic_garage_command",
      "homematic_garage_ventilation",
      "homematic_garage_light",
    ]);
    expect(binding("garagedoor_closed")).toMatchObject({
      channelAddress: `${address}:1`,
      parameter: "DOOR_STATE",
      writeChannelAddress: `${address}:1`,
      writeParameter: "DOOR_COMMAND",
      readable: true,
      writable: true,
    });
    expect(binding("onoff")).toMatchObject({
      channelAddress: `${address}:2`,
      parameter: "STATE",
      writeChannelAddress: `${address}:2`,
      writeParameter: "STATE",
      readable: true,
      writable: true,
    });
    expect(binding("homematic_garage_light")).toEqual({
      ...binding("onoff"),
      capability: "homematic_garage_light",
    });
    expect(binding("homematic_garage_state").writable).toBe(false);
    for (const capability of [
      "homematic_garage_command",
      "homematic_garage_ventilation",
    ]) {
      expect(binding(capability)).toMatchObject({
        parameter: "DOOR_COMMAND",
        readable: false,
        writable: true,
      });
    }
    expect(parseStoredBindings(JSON.parse(JSON.stringify(bindings)))).toEqual(
      bindings,
    );
  });

  it.each([
    ["garagedoor_closed", false, 1, "DOOR_COMMAND", "OPEN"],
    ["garagedoor_closed", true, 1, "DOOR_COMMAND", "CLOSE"],
    ["homematic_garage_command", "up", 1, "DOOR_COMMAND", "OPEN"],
    ["homematic_garage_command", "idle", 1, "DOOR_COMMAND", "STOP"],
    ["homematic_garage_command", "down", 1, "DOOR_COMMAND", "CLOSE"],
    ["homematic_garage_ventilation", true, 1, "DOOR_COMMAND", "PARTIAL_OPEN"],
    ["onoff", true, 2, "STATE", true],
    ["onoff", false, 2, "STATE", false],
    ["homematic_garage_light", true, 2, "STATE", true],
    ["homematic_garage_light", false, 2, "STATE", false],
  ] as const)(
    "writes %s=%s with the documented channel, parameter and value",
    async (capability, value, channel, parameter, expected) => {
      const { address, runtime, client, binding } = await fixture();
      await runtime.write(binding(capability), value);
      expect(client.setValue).toHaveBeenCalledExactlyOnceWith(
        `${address}:${channel}`,
        parameter,
        expected,
        undefined,
      );
    },
  );

  it.each([
    ["CLOSED", true, "closed"],
    [0, true, "closed"],
    ["OPEN", false, "open"],
    [1, false, "open"],
    ["VENTILATION_POSITION", false, "ventilation"],
    [2, false, "ventilation"],
    ["POSITION_UNKNOWN", null, "unknown"],
    [3, null, "unknown"],
  ] as const)(
    "represents the reported state %s without assuming an unknown position is closed",
    async (state, closed, label) => {
      const { address, values, runtime, binding } = await fixture();
      values.set(`${address}:1`, { DOOR_STATE: state });
      await expect(runtime.read(binding("garagedoor_closed"))).resolves.toBe(
        closed,
      );
      await expect(
        runtime.read(binding("homematic_garage_state")),
      ).resolves.toBe(label);
    },
  );

  it("rejects invalid command inputs without issuing a motor command", async () => {
    const { runtime, client, binding } = await fixture();
    await expect(
      runtime.write(binding("homematic_garage_command"), "toggle"),
    ).rejects.toThrow("Unsupported Homey garage command");
    await expect(
      runtime.write(binding("homematic_garage_ventilation"), false),
    ).rejects.toThrow("Unsupported Homey garage ventilation command");
    expect(client.setValue).not.toHaveBeenCalled();
  });

  it("upgrades already paired devices and acknowledges unknown-position callbacks before light events", async () => {
    const { address, runtime, binding, bindings } = await fixture();
    const { device } = homeyPort();
    const previousBindings: CapabilityBinding[] = [
      {
        ...binding("garagedoor_closed"),
        transform: "garage-door-state-to-closed",
      },
      binding("onoff"),
    ];
    const persistBindings = vi.fn().mockResolvedValue(undefined);
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(
      runtime,
      device,
      previousBindings,
      { resolveBindings: () => bindings, persistBindings },
    );
    try {
      await controller.start();
      expect(persistBindings).toHaveBeenCalledWith(bindings);
      expect(device.removeCapability).not.toHaveBeenCalled();
      expect(device.addCapability).toHaveBeenCalledTimes(4);
      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        "garagedoor_closed",
        true,
      );
      expect(device.setCapabilityValue).toHaveBeenCalledWith("onoff", false);
      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        "homematic_garage_light",
        false,
      );
      await expect(
        runtime.createCallbackDispatcher().dispatch("system.multicall", [
          [
            {
              methodName: "event",
              params: [
                "HmIP-RF",
                `${address}:1`,
                "DOOR_STATE",
                "POSITION_UNKNOWN",
              ],
            },
            {
              methodName: "event",
              params: ["HmIP-RF", `${address}:2`, "STATE", true],
            },
          ],
        ]),
      ).resolves.toEqual([[""], [""]]);
      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        "garagedoor_closed",
        null,
      );
      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        "homematic_garage_state",
        "unknown",
      );
      expect(device.setCapabilityValue).toHaveBeenCalledWith("onoff", true);
      expect(device.setCapabilityValue).toHaveBeenLastCalledWith(
        "homematic_garage_light",
        true,
      );
      expect(device.error).not.toHaveBeenCalled();
    } finally {
      controller.stop();
    }
  });

  it("adds the light button to a current paired garage without replacing its existing capabilities", async () => {
    const { runtime, bindings } = await fixture();
    const previousBindings = bindings.filter(
      ({ capability }) => capability !== "homematic_garage_light",
    );
    const { device } = homeyPort(
      previousBindings.map(({ capability }) => capability),
    );
    const persistBindings = vi.fn().mockResolvedValue(undefined);
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(
      runtime,
      device,
      previousBindings,
      { resolveBindings: () => bindings, persistBindings },
    );
    try {
      await controller.start();
      expect(device.addCapability).toHaveBeenCalledExactlyOnceWith(
        "homematic_garage_light",
      );
      expect(device.removeCapability).not.toHaveBeenCalled();
      expect(device.getCapabilities()).toEqual(
        bindings.map(({ capability }) => capability),
      );
      expect(persistBindings).toHaveBeenCalledExactlyOnceWith(bindings);
    } finally {
      controller.stop();
    }
  });

  it.each(["onoff", "homematic_garage_light"])(
    "synchronizes both light controls from callbacks after %s writes without duplicate commands",
    async (capability) => {
      vi.useFakeTimers();
      const { address, runtime, client, bindings } = await fixture();
      const { device, write } = homeyPort();
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(runtime, device, bindings);
      try {
        await controller.start();
        client.getParamset.mockClear();
        for (const state of [true, false]) {
          client.setValue.mockClear();
          device.setCapabilityValue.mockClear();
          await write(capability, state);
          expect(client.setValue).toHaveBeenCalledExactlyOnceWith(
            `${address}:2`,
            "STATE",
            state,
            undefined,
          );
          await runtime
            .createCallbackDispatcher()
            .dispatch("event", ["HmIP-RF", `${address}:2`, "STATE", state]);
          expect(device.setCapabilityValue).toHaveBeenCalledWith(
            "onoff",
            state,
          );
          expect(device.setCapabilityValue).toHaveBeenCalledWith(
            "homematic_garage_light",
            state,
          );
        }
        await vi.advanceTimersByTimeAsync(40_000);
        expect(client.getParamset).not.toHaveBeenCalled();
        expect(device.error).not.toHaveBeenCalled();
      } finally {
        controller.stop();
        vi.useRealTimers();
      }
    },
  );

  it.each([
    ["onoff", true],
    ["homematic_garage_light", true],
    ["onoff", false],
    ["homematic_garage_light", false],
  ] as const)(
    "synchronizes both light controls when %s is read back as %s without a callback",
    async (capability, actual) => {
      vi.useFakeTimers();
      const { address, runtime, client, values, bindings } = await fixture();
      const { device, write } = homeyPort();
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(runtime, device, bindings);
      try {
        await controller.start();
        device.setCapabilityValue.mockClear();
        client.getParamset.mockClear();
        await write(capability, true);
        values.set(`${address}:2`, { STATE: actual });
        await vi.advanceTimersByTimeAsync(actual ? 3_000 : 33_000);
        expect(device.setCapabilityValue).toHaveBeenCalledWith("onoff", actual);
        expect(device.setCapabilityValue).toHaveBeenCalledWith(
          "homematic_garage_light",
          actual,
        );
        expect(client.getParamset).toHaveBeenCalledTimes(actual ? 1 : 3);
        expect(client.setValue).toHaveBeenCalledOnce();
        expect(device.error).toHaveBeenCalledTimes(actual ? 0 : 1);
        expect(device.setUnavailable).not.toHaveBeenCalled();
      } finally {
        controller.stop();
        vi.useRealTimers();
      }
    },
  );

  it.each(["onoff", "homematic_garage_light"])(
    "replaces pending %s verification when the other light control issues a newer command",
    async (capability) => {
      vi.useFakeTimers();
      const { runtime, client, bindings } = await fixture();
      const { device, write } = homeyPort();
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(runtime, device, bindings);
      try {
        await controller.start();
        client.getParamset.mockClear();
        device.setCapabilityValue.mockClear();
        await write(capability, true);
        await write(
          capability === "onoff" ? "homematic_garage_light" : "onoff",
          false,
        );
        await vi.advanceTimersByTimeAsync(40_000);
        expect(client.setValue).toHaveBeenCalledTimes(2);
        expect(client.getParamset).toHaveBeenCalledOnce();
        expect(device.setCapabilityValue).toHaveBeenCalledWith("onoff", false);
        expect(device.setCapabilityValue).toHaveBeenCalledWith(
          "homematic_garage_light",
          false,
        );
        expect(device.error).not.toHaveBeenCalled();
        expect(device.setUnavailable).not.toHaveBeenCalled();
      } finally {
        controller.stop();
        vi.useRealTimers();
      }
    },
  );

  it.each(["success", "failure"] as const)(
    "ignores an in-flight light readback %s superseded by the other control",
    async (reply) => {
      vi.useFakeTimers();
      const { runtime, client, bindings } = await fixture();
      const { device, write } = homeyPort();
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(runtime, device, bindings);
      let resolveRead: ((values: Record<string, RpcValue>) => void) | undefined;
      let rejectRead: ((error: Error) => void) | undefined;
      try {
        await controller.start();
        client.getParamset.mockClear();
        client.getParamset.mockImplementationOnce(
          () =>
            new Promise<Record<string, RpcValue>>((resolve, reject) => {
              resolveRead = resolve;
              rejectRead = reject;
            }),
        );
        device.setCapabilityValue.mockClear();
        await write("onoff", true);
        await vi.advanceTimersByTimeAsync(3_000);
        expect(client.getParamset).toHaveBeenCalledOnce();
        await write("homematic_garage_light", false);
        if (reply === "success") resolveRead?.({ STATE: true });
        else rejectRead?.(new Error("Superseded readback failed"));
        await vi.advanceTimersByTimeAsync(0);
        expect(device.setCapabilityValue).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(40_000);
        expect(client.getParamset).toHaveBeenCalledTimes(2);
        expect(device.setCapabilityValue).toHaveBeenCalledWith("onoff", false);
        expect(device.setCapabilityValue).toHaveBeenCalledWith(
          "homematic_garage_light",
          false,
        );
        expect(device.error).not.toHaveBeenCalled();
        expect(device.setUnavailable).not.toHaveBeenCalled();
      } finally {
        controller.stop();
        vi.useRealTimers();
      }
    },
  );

  it("does not read back write-only commands or falsely mark the device unavailable", async () => {
    vi.useFakeTimers();
    const { runtime, client, bindings } = await fixture();
    const { device, write } = homeyPort();
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, device, bindings);
    try {
      await controller.start();
      client.getParamset.mockClear();
      await write("homematic_garage_command", "idle");
      await write("homematic_garage_ventilation", true);
      await vi.advanceTimersByTimeAsync(40_000);
      expect(client.getParamset).not.toHaveBeenCalled();
      expect(device.setUnavailable).not.toHaveBeenCalled();
      expect(device.error).not.toHaveBeenCalled();
    } finally {
      controller.stop();
      vi.useRealTimers();
    }
  });

  it.each(["success", "failure"] as const)(
    "waits for a delayed command %s instead of acknowledging it before the RPC reply",
    async (reply) => {
      vi.useFakeTimers();
      const { runtime, client, bindings } = await fixture();
      const { device, write } = homeyPort();
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(runtime, device, bindings);
      const failure = new Error("XML-RPC command rejected after radio delay");
      let resolveCommand: (() => void) | undefined;
      let rejectCommand: ((error: Error) => void) | undefined;
      client.setValue.mockImplementationOnce(
        () =>
          new Promise<void>((resolve, reject) => {
            resolveCommand = resolve;
            rejectCommand = reject;
          }),
      );
      try {
        await controller.start();
        client.getParamset.mockClear();
        const completed = vi.fn();
        const result = write("homematic_garage_command", "idle").then(
          () => ({ status: "success" as const }),
          (error: unknown) => ({ status: "failure" as const, error }),
        );
        void result.then(completed);
        await vi.advanceTimersByTimeAsync(1_500);
        expect(completed).not.toHaveBeenCalled();
        if (reply === "success") resolveCommand?.();
        else rejectCommand?.(failure);
        await expect(result).resolves.toEqual(
          reply === "success"
            ? { status: "success" }
            : { status: "failure", error: failure },
        );
        await vi.advanceTimersByTimeAsync(40_000);
        expect(client.setValue).toHaveBeenCalledOnce();
        expect(client.getParamset).not.toHaveBeenCalled();
        expect(device.setUnavailable).not.toHaveBeenCalled();
      } finally {
        controller.stop();
        vi.useRealTimers();
      }
    },
  );

  it("still reports failed door and light writes and never retries a motor command automatically", async () => {
    const { runtime, client, bindings } = await fixture();
    const { device, write } = homeyPort();
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, device, bindings);
    try {
      await controller.start();
      client.setValue.mockRejectedValue(new Error("XML-RPC setValue failed"));
      await expect(write("homematic_garage_command", "up")).rejects.toThrow(
        "XML-RPC setValue failed",
      );
      await expect(write("onoff", true)).rejects.toThrow(
        "XML-RPC setValue failed",
      );
      await expect(write("homematic_garage_light", true)).rejects.toThrow(
        "XML-RPC setValue failed",
      );
      expect(client.setValue).toHaveBeenCalledTimes(3);
      expect(device.error).toHaveBeenCalledTimes(3);
    } finally {
      controller.stop();
    }
  });
});
