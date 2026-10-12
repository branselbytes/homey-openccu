import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import { ProfileRegistry } from "../../src/profiles/registry";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import {
  transformFromOpenCcu,
  transformToOpenCcu,
} from "../../src/mapping/transforms";
interface Fixture {
  description: DeviceDescription;
  channels: {
    description: DeviceDescription;
    parameters: ParamsetDescription;
    configuration?: Record<string, RpcValue>;
  }[];
}
const fixtures = JSON.parse(
  readFileSync("tests/fixtures/reference-catalog.json", "utf8"),
) as Fixture[];
const registry = new ProfileRegistry();
async function discover(f: Fixture) {
  const client = {
    listDevices: vi
      .fn()
      .mockResolvedValue([
        f.description,
        ...f.channels.map((c) => c.description),
      ]),
    getParamsetDescription: vi.fn((address: string) =>
      Promise.resolve(
        f.channels.find((c) => c.description.ADDRESS === address)?.parameters ??
          {},
      ),
    ),
    getParamset: vi.fn((address: string, key: string) =>
      Promise.resolve(
        key === "MASTER"
          ? (f.channels.find((c) => c.description.ADDRESS === address)
              ?.configuration ?? {})
          : {},
      ),
    ),
    getValue: vi.fn().mockResolvedValue(0),
    setValue: vi.fn().mockResolvedValue(undefined),
    putParamset: vi.fn().mockResolvedValue(undefined),
    init: vi.fn(),
  } satisfies XmlRpcClient;
  const runtime = new OpenCcuRuntime(client, {
    centralId: "fixture",
    interfaceId: f.description.TYPE.startsWith("HM-") ? "BidCos-RF" : "HmIP-RF",
  });
  await runtime.refresh();
  return { runtime, client, candidates: runtime.pairingCandidates() };
}
describe("reference catalog integration", () => {
  it.each(fixtures)(
    "discovers $description.TYPE with functional capabilities or events",
    async (f) => {
      const { candidates } = await discover(f);
      expect(candidates.length, f.description.TYPE).toBeGreaterThan(0);
      for (const c of candidates) {
        expect(c.store.generic).not.toBe(true);
        expect(
          c.capabilities.filter(
            (x) =>
              ![
                "alarm_battery",
                "homematic_rooms",
                "homematic_functions",
              ].includes(x),
          ).length + c.mapping.buttonEvents.length,
        ).toBeGreaterThan(0);
      }
    },
  );
  it.each(fixtures)(
    "uses described read/write channels for $description.TYPE",
    (f) => {
      const p = registry.find(f.description.TYPE)!;
      for (const def of p.logicalDevices ?? [p])
        for (const b of def.bindings) {
          const read = f.channels.find(
            (c) => c.description.INDEX === b.channel,
          )?.parameters;
          // Optional maintenance/climate features vary by firmware. Actuator commands
          // must match the actual receiver and may never target a read-only feedback.
          if (!b.requiresWriteTarget) continue;
          const write = f.channels.find(
            (c) => c.description.INDEX === (b.setChannel ?? b.channel),
          )?.parameters;
          expect(
            read?.[b.parameter],
            `${f.description.TYPE} ${b.capability} read ${b.channel}:${b.parameter}`,
          ).toBeDefined();
          expect(
            (write?.[b.setParameter ?? b.parameter]?.OPERATIONS ?? 0) & 2,
            `${f.description.TYPE} ${b.capability} write`,
          ).toBe(2);
          for (const required of b.requiredWriteParameters ?? [])
            expect(
              (write?.[required]?.OPERATIONS ?? 0) & 2,
              `${f.description.TYPE} ${required}`,
            ).toBe(2);
        }
    },
  );
  it("retains STE2 primary identity, exposes CCU difference and forbids all temperature writes", async () => {
    const f = fixtures.find((f) => f.description.TYPE === "HmIP-STE2-PCB")!;
    const { runtime, candidates, client } = await discover(f);
    expect(candidates).toHaveLength(1);
    expect(
      candidates[0].store.bindings
        .filter((b) => b.parameter === "ACTUAL_TEMPERATURE")
        .map((b) => [b.capability, b.channelAddress, b.writable]),
    ).toEqual([
      ["measure_temperature", "CATALOG:1", false],
      ["measure_temperature.second", "CATALOG:2", false],
      ["measure_temperature.difference", "CATALOG:3", false],
    ]);
    for (const b of candidates[0].store.bindings.filter(
      (b) => b.parameter === "ACTUAL_TEMPERATURE",
    ))
      await expect(runtime.write(b, 20)).rejects.toThrow("not writable");
    expect(client.setValue).not.toHaveBeenCalled();
  });
  it("routes classic siren alarms independently and encodes arming as a BidCos integer", async () => {
    const { runtime, candidates, client } = await discover(
      fixtures.find((f) => f.description.TYPE === "HM-Sec-Sir-WM")!,
    );
    for (const [cap, ch, value, param, expected] of [
      ["onoff", 3, true, "STATE", true],
      ["onoff.perimeter", 1, true, "STATE", true],
      ["onoff.interior", 2, false, "STATE", false],
      ["homematic_siren_arming", 4, "2", "ARMSTATE", 2],
    ] as const) {
      await runtime.write(
        candidates[0].store.bindings.find((b) => b.capability === cap)!,
        value,
      );
      expect(client.setValue).toHaveBeenLastCalledWith(
        `CATALOG:${ch}`,
        param,
        expected,
        undefined,
      );
    }
  });
  it("writes one complete display line and rejects invalid text before transport", async () => {
    const { runtime, candidates, client } = await discover(
      fixtures.find((f) => f.description.TYPE === "HmIP-WRCD")!,
    );
    const binding = candidates[0].store.bindings.find(
      (b) => b.capability === "homematic_display_text.line4",
    )!;
    await runtime.write(binding, "Garage closed");
    expect(client.putParamset).toHaveBeenCalledWith(
      "CATALOG:3",
      "VALUES",
      expect.objectContaining({
        DISPLAY_DATA_ID: 4,
        DISPLAY_DATA_STRING: "Garage closed",
        DISPLAY_DATA_COMMIT: true,
      }),
      undefined,
    );
    for (const value of ["12345678901234567", "\n", 17])
      await expect(runtime.write(binding, value)).rejects.toThrow();
    expect(client.putParamset).toHaveBeenCalledTimes(1);
  });
  it("normalizes classic numeric and symbolic states without inventing lock sensor commands", () => {
    for (const [i, name] of [
      "DISARMED",
      "EXTSENS_ARMED",
      "ALLSENS_ARMED",
      "ALARM_BLOCKED",
    ].entries()) {
      expect(transformFromOpenCcu("siren-arming", i)).toBe(String(i));
      expect(transformFromOpenCcu("siren-arming", name)).toBe(String(i));
      expect(transformToOpenCcu("siren-arming", String(i))).toBe(i);
    }
    expect(transformFromOpenCcu("lock-sensor-state", 0)).toBe("UNKNOWN");
    expect(() => transformToOpenCcu("lock-sensor-state", "LOCKED")).toThrow();
  });
});

it("retains read-only classic contacts even when metadata incorrectly permits writes", async () => {
  const f = structuredClone(
    fixtures.find((f) => f.description.TYPE === "HM-SCI-3-FM")!,
  );
  for (const c of f.channels)
    if (c.parameters.STATE)
      c.parameters = {
        ...c.parameters,
        STATE: { ...c.parameters.STATE, OPERATIONS: 7 },
      };
  const { runtime, candidates, client } = await discover(f);
  expect(candidates).toHaveLength(1);
  const contacts = candidates[0].store.bindings.filter(
    (b) => b.parameter === "STATE",
  );
  expect(contacts).toHaveLength(3);
  for (const b of contacts)
    await expect(runtime.write(b, true)).rejects.toThrow("not writable");
  expect(client.setValue).not.toHaveBeenCalled();
});
it("offers keypad lock/unlock events per channel without permission writes", async () => {
  const { candidates, client } = await discover(
    fixtures.find((f) => f.description.TYPE === "HmIP-WKP")!,
  );
  const events = candidates[0].mapping.buttonEvents;
  expect(events).toHaveLength(16);
  expect(events[0]).toMatchObject({
    channelAddress: "CATALOG:1",
    parameter: "PRESS_LOCK",
    button: 1,
    pressType: "lock",
  });
  expect(events[15]).toMatchObject({
    channelAddress: "CATALOG:16",
    parameter: "PRESS_UNLOCK",
    button: 16,
    pressType: "unlock",
  });
  expect(candidates[0].store.bindings.every((b) => !b.writable)).toBe(true);
  expect(client.setValue).not.toHaveBeenCalled();
});
it("starts MP3 playback in a single command and preserves a separate STOP command", async () => {
  const { runtime, candidates, client } = await discover(
    fixtures.find((f) => f.description.TYPE === "HmIP-MP3P")!,
  );
  const sound = candidates.find((c) => c.data.logicalId === "sound")!;
  await runtime.write(
    sound.store.bindings.find((b) => b.capability === "homematic_sound_file")!,
    12,
  );
  expect(client.putParamset).toHaveBeenCalledWith(
    "CATALOG:2",
    "VALUES",
    {
      SOUNDFILE: "SOUNDFILE_012",
      LEVEL: 0.5,
      DURATION_UNIT: "S",
      DURATION_VALUE: 10,
    },
    undefined,
  );
  await runtime.write(
    sound.store.bindings.find((b) => b.capability === "button.stop")!,
    true,
  );
  expect(client.setValue).toHaveBeenCalledWith(
    "CATALOG:2",
    "STOP",
    true,
    undefined,
  );
});
it("removes unavailable compound controls when required command parameters are read-only", async () => {
  for (const model of ["HmIP-MP3P", "HmIP-WRCD"]) {
    const f = structuredClone(
      fixtures.find((f) => f.description.TYPE === model)!,
    );
    for (const c of f.channels) {
      const p =
        model === "HmIP-MP3P" ? "DURATION_VALUE" : "DISPLAY_DATA_COMMIT";
      if (c.parameters[p])
        c.parameters = {
          ...c.parameters,
          [p]: { ...c.parameters[p], OPERATIONS: 1 },
        };
    }
    const { candidates } = await discover(f);
    expect(
      candidates
        .flatMap((c) => c.store.bindings)
        .some(
          (b) =>
            b.writeStrategy === "sound-file" ||
            b.writeStrategy === "display-text",
        ),
    ).toBe(false);
  }
});

it("upgrades an existing STE2 device and delivers each probe callback to its own capability", async () => {
  const { DeviceBindingController } =
    await import("../../src/homey/device-binding-controller");
  const { runtime, candidates } = await discover(
    fixtures.find((f) => f.description.TYPE === "HmIP-STE2-PCB")!,
  );
  runtime.publishConnectionState("healthy");
  const capabilities = new Set(["measure_temperature"]);
  const values = new Map<string, RpcValue>();
  const persistBindings = vi.fn().mockResolvedValue(undefined);
  const bindings = candidates[0].store.bindings;
  const controller = new DeviceBindingController(
    runtime,
    {
      getCapabilities: () => [...capabilities],
      addCapability: (id) => {
        capabilities.add(id);
        return Promise.resolve();
      },
      removeCapability: (id) => {
        capabilities.delete(id);
        return Promise.resolve();
      },
      setCapabilityValue: (id, value) => {
        values.set(id, value);
        return Promise.resolve();
      },
      triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
      onCapabilityWrite: vi.fn(),
      setAvailable: vi.fn(),
      setUnavailable: vi.fn(),
      log: vi.fn(),
      error: vi.fn(),
    },
    bindings.filter((b) => b.capability === "measure_temperature"),
    { resolveBindings: () => bindings, persistBindings },
  );
  try {
    await controller.start();
    expect(capabilities).toEqual(
      new Set([
        "measure_temperature",
        "measure_temperature.second",
        "measure_temperature.difference",
        "alarm_battery",
      ]),
    );
    expect(persistBindings).toHaveBeenCalledWith(bindings);
    for (const [channel, value] of [
      [1, 30.5],
      [2, 28],
      [3, 2.5],
    ])
      await runtime
        .createCallbackDispatcher()
        .dispatch("event", [
          "HmIP-RF",
          `CATALOG:${channel}`,
          "ACTUAL_TEMPERATURE",
          value,
        ]);
    expect(values.get("measure_temperature")).toBe(30.5);
    expect(values.get("measure_temperature.second")).toBe(28);
    expect(values.get("measure_temperature.difference")).toBe(2.5);
  } finally {
    controller.stop();
  }
});
