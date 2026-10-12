import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { STATUS_FLOW_DEFINITIONS } from "../../src/homey/status-flow-definitions";
import {
  registerStatusFlowCards,
  statusTokens,
  type StatusValue,
} from "../../src/homey/status-flow-controller";
import { StatusUpdates } from "../../src/homey/status-updates";
import { ALL_PROFILES } from "../../src/profiles/registry";
function cards() {
  const conditions = new Map<
    string,
    (args: Record<string, unknown>) => Promise<unknown>
  >();
  const actions = new Map<
    string,
    (args: Record<string, unknown>) => Promise<unknown>
  >();
  registerStatusFlowCards({
    getConditionCard: (id) => ({
      registerRunListener: (fn) => conditions.set(id, fn),
    }),
    getActionCard: (id) => ({
      registerRunListener: (fn) => actions.set(id, fn),
    }),
  });
  return { conditions, actions };
}
describe("status Flow coverage", () => {
  it.each(STATUS_FLOW_DEFINITIONS)(
    "$capability has correctly filtered cards, typed tags, conditions and translated states",
    async (d) => {
      const trigger = JSON.parse(
        readFileSync(`.homeycompose/flow/triggers/${d.trigger}.json`, "utf8"),
      ) as {
        args: { filter: string }[];
        tokens: { name: string; type: string }[];
      };
      const condition = JSON.parse(
        readFileSync(
          `.homeycompose/flow/conditions/${d.condition}.json`,
          "utf8",
        ),
      ) as { args: { filter: string }[] };
      const filter = new URLSearchParams(trigger.args[0].filter);
      expect(condition.args[0].filter).toBe(trigger.args[0].filter);
      expect(filter.get("capabilities")).toBe(d.capability);
      for (const p of ALL_PROFILES)
        if (
          (p.logicalDevices ?? [p]).some((l) =>
            l.bindings.some((b) => b.capability === d.capability),
          )
        )
          expect(filter.get("driver_id")!.split("|")).toContain(p.driverId);
      if (!d.capability.startsWith("openccu_"))
        expect(filter.get("driver_id")!.split("|")).toContain(
          "openccu-generic",
        );
      const value =
        d.type === "number"
          ? 12
          : d.type === "boolean"
            ? true
            : d.values![0].id;
      const tags = statusTokens(d.capability, value, "de");
      for (const t of trigger.tokens) expect(typeof tags[t.name]).toBe(t.type);
      const { conditions } = cards();
      const device = {
        hasCapability: () => true,
        getCapabilityValue: () => value,
      };
      expect(
        await conditions.get(d.condition)!({
          device,
          value: d.type === "boolean" ? "true" : value,
          operator: "eq",
        }),
      ).toBe(true);
      for (const invalid of [null, undefined, {}, NaN])
        expect(() =>
          conditions.get(d.condition)!({
            device: { ...device, getCapabilityValue: () => invalid },
            value,
            operator: "eq",
          }),
        ).toThrow();
    },
  );
  it("covers every readable custom capability except existing garage/handle cards and organization tags", () => {
    const app = JSON.parse(readFileSync("app.json", "utf8")) as {
      capabilities: Record<string, { getable: boolean }>;
    };
    const excluded = [
      "homematic_rhs_state",
      "homematic_garage_state",
      "homematic_garage_light",
      "openccu_room",
      "openccu_functions",
    ];
    for (const [id, c] of Object.entries(app.capabilities))
      if (c.getable && !excluded.includes(id))
        expect(
          STATUS_FLOW_DEFINITIONS.some(
            (d) => d.capability.split(".")[0] === id,
          ),
          id,
        ).toBe(true);
  });
  it("distinguishes PM1, PM2.5 and PM10", () =>
    expect(
      STATUS_FLOW_DEFINITIONS.filter((d) =>
        d.capability.startsWith("homematic_particulate"),
      ).map((d) => d.title.de),
    ).toEqual([
      "PM1-Konzentration",
      "PM2,5-Konzentration",
      "PM10-Konzentration",
    ]));
  it("produces meaningful enum text while preserving raw IDs", () => {
    expect(statusTokens("homematic_siren_arming", "2", "de")).toEqual({
      value: "2",
      status: "Alle Sensoren scharf",
    });
    expect(statusTokens("homematic_lock_state", "LOCKED", "en")).toEqual({
      value: "LOCKED",
      status: "Locked",
    });
    expect(
      statusTokens("homematic_passage_count", 4, "de", () => false),
    ).toEqual({ value: 4, direction: "Nein" });
    expect(statusTokens("homematic_passage_count", 4, "de")).toEqual({
      value: 4,
      direction: "Unbekannt",
    });
  });
  it.each([
    ["eq", 12, true],
    ["gt", 11, true],
    ["lt", 13, true],
    ["gte", 12, true],
    ["lte", 12, true],
    ["gt", 13, false],
  ] as const)(
    "evaluates numeric comparison %s",
    async (operator, value, expected) => {
      const d = STATUS_FLOW_DEFINITIONS.find((d) => d.type === "number")!;
      const { conditions } = cards();
      expect(
        await conditions.get(d.condition)!({
          device: { hasCapability: () => true, getCapabilityValue: () => 12 },
          operator,
          value,
        }),
      ).toBe(expected);
    },
  );
  it("routes detection and boost-off without sending invalid arguments", async () => {
    const { actions } = cards();
    const device = {
      hasCapability: () => true,
      triggerCapabilityListener: vi.fn().mockResolvedValue(undefined),
    };
    await actions.get("set_detection_active")!({ device, active: "false" });
    expect(device.triggerCapabilityListener).toHaveBeenLastCalledWith(
      "homematic_detection_active",
      false,
    );
    await actions.get("set_detection_active")!({ device, active: "true" });
    expect(device.triggerCapabilityListener).toHaveBeenLastCalledWith(
      "homematic_detection_active",
      true,
    );
    await actions.get("deactivate_thermostat_boost")!({ device });
    expect(device.triggerCapabilityListener).toHaveBeenLastCalledWith(
      "homematic_thermostat_boost",
      false,
    );
    expect(() =>
      actions.get("set_detection_active")!({ device, active: 1 }),
    ).toThrow();
    expect(device.triggerCapabilityListener).toHaveBeenCalledTimes(3);
  });
});
function updates() {
  const values = new Map<string, unknown>();
  const trigger = vi.fn((id: string, value: StatusValue) => {
    expect(values.get(id)).toBe(value);
    return Promise.resolve();
  });
  const error = vi.fn();
  const u = new StatusUpdates(
    (id, v) => {
      values.set(id, v);
      return Promise.resolve();
    },
    trigger,
    error,
  );
  return { u, values, trigger, error };
}
describe("status transition delivery", () => {
  it("initializes silently and serializes/deduplicates live transitions", async () => {
    const { u, trigger } = updates();
    const id = "homematic_valve_active";
    await u.update(id, false);
    await Promise.all([
      u.update(id, true, true),
      u.update(id, true, true),
      u.update(id, false, true),
    ]);
    expect(trigger.mock.calls).toEqual([
      [id, true],
      [id, false],
    ]);
  });
  it("rejects stale initial values even if callbacks arrive before their queued application", async () => {
    const { u, values, trigger } = updates();
    const id = "homematic_measure_valve";
    await u.update(id, 10);
    const revision = u.revision(id);
    await Promise.all([
      u.update(id, 20, false, revision),
      u.update(id, 30, true),
    ]);
    expect(values.get(id)).toBe(30);
    expect(trigger).toHaveBeenCalledTimes(1);
    await u.update(id, 5, false, revision);
    expect(values.get(id)).toBe(30);
  });
  it("silences unknown recovery and reconnect initialization and invalidates stopped work", async () => {
    const { u, trigger } = updates();
    const id = "homematic_siren_arming";
    await u.update(id, "0");
    await u.update(id, null, true);
    await u.update(id, "2", true);
    expect(trigger).not.toHaveBeenCalled();
    const pending = u.update(id, "1", true);
    u.reset();
    await pending;
    await u.update(id, "3");
    expect(trigger).not.toHaveBeenCalled();
    await u.update(id, "0", true);
    expect(trigger).toHaveBeenCalledWith(id, "0");
  });
  it("emits later connection and polled metric changes but no first snapshot", async () => {
    const { u, trigger } = updates();
    await u.update("openccu_connection_status", "healthy", true);
    await u.update("openccu_measure_service_messages", 0, true);
    expect(trigger).not.toHaveBeenCalled();
    await u.update("openccu_connection_status", "disconnected", true);
    await u.update("openccu_measure_service_messages", 2, true);
    expect(trigger).toHaveBeenCalledTimes(2);
  });
  it("recovers after trigger errors without unhandled rejections", async () => {
    const { u, trigger, error } = updates();
    await u.update("homematic_playing", false);
    trigger.mockRejectedValueOnce(new Error("Flow failed"));
    await u.update("homematic_playing", true, true);
    expect(error).toHaveBeenCalledTimes(1);
    await u.update("homematic_playing", false, true);
    await u.update("homematic_playing", true, true);
    expect(trigger).toHaveBeenCalledTimes(2);
  });
});

it("invalidates the first pending initialization read on stop", async () => {
  const { u, values } = updates();
  const id = "homematic_measure_valve";
  const revision = u.revision(id);
  u.reset();
  await u.update(id, 40, false, revision);
  expect(values.has(id)).toBe(false);
});
it("routes an XML-RPC lock-sensor callback through production reconciliation to its Flow", async () => {
  const { OpenCcuRuntime } = await import("../../src/runtime/openccu-runtime");
  const { DeviceBindingController } =
    await import("../../src/homey/device-binding-controller");
  const runtime = new OpenCcuRuntime(
    {
      listDevices: vi.fn().mockResolvedValue([
        { ADDRESS: "FLOWTEST", TYPE: "HmIP-DLS", CHILDREN: ["FLOWTEST:1"] },
        {
          ADDRESS: "FLOWTEST:1",
          PARENT: "FLOWTEST",
          TYPE: "DOOR_LOCK_STATE_TRANSCEIVER",
          PARAMSETS: ["VALUES"],
        },
      ]),
      getParamsetDescription: vi.fn().mockResolvedValue({
        LOCK_STATE: {
          TYPE: "ENUM",
          OPERATIONS: 5,
          FLAGS: 1,
          VALUE_LIST: ["UNKNOWN", "LOCKED", "UNLOCKED"],
        },
      }),
      getParamset: vi.fn().mockResolvedValue({ LOCK_STATE: "LOCKED" }),
      getValue: vi.fn(),
      setValue: vi.fn(),
      putParamset: vi.fn(),
      init: vi.fn(),
    },
    { centralId: "test", interfaceId: "HmIP-RF" },
  );
  await runtime.refresh();
  runtime.publishConnectionState("healthy");
  const candidate = runtime.pairingCandidates()[0];
  const values = new Map<string, unknown>();
  const triggerStatusChanged = vi.fn((id: string, value: StatusValue) => {
    expect(values.get(id)).toBe(value);
    return Promise.resolve();
  });
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
      triggerStatusChanged,
      triggerButtonEvent: vi.fn(),
      onCapabilityWrite: vi.fn(),
      setAvailable: vi.fn(),
      setUnavailable: vi.fn(),
      log: vi.fn(),
      error: vi.fn(),
    },
    candidate.store.bindings,
  );
  try {
    await controller.start();
    expect(triggerStatusChanged).not.toHaveBeenCalled();
    await runtime
      .createCallbackDispatcher()
      .dispatch("event", ["HmIP-RF", "FLOWTEST:1", "LOCK_STATE", "UNLOCKED"]);
    await vi.waitFor(() =>
      expect(triggerStatusChanged).toHaveBeenCalledWith(
        "homematic_lock_state",
        "UNLOCKED",
      ),
    );
    await runtime
      .createCallbackDispatcher()
      .dispatch("event", ["HmIP-RF", "FLOWTEST:1", "LOCK_STATE", "UNLOCKED"]);
    await Promise.resolve();
    expect(triggerStatusChanged).toHaveBeenCalledTimes(1);
  } finally {
    controller.stop();
  }
});
