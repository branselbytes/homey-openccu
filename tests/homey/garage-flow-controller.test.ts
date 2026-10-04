import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { registerGarageFlowCards } from "../../src/homey/garage-flow-controller";

type FlowListener = (
  args: Readonly<Record<string, unknown>>,
) => Promise<unknown>;

function fixture() {
  const actions = new Map<string, FlowListener>();
  const conditions = new Map<string, FlowListener>();
  const flow = {
    getActionCard: (id: string) => ({
      registerRunListener: (listener: FlowListener) =>
        actions.set(id, listener),
    }),
    getConditionCard: (id: string) => ({
      registerRunListener: (listener: FlowListener) =>
        conditions.set(id, listener),
    }),
  };
  registerGarageFlowCards(flow);
  const device = {
    hasCapability: vi.fn().mockReturnValue(true),
    triggerCapabilityListener: vi.fn().mockResolvedValue(undefined),
    getCapabilityValue: vi.fn().mockReturnValue("closed"),
  };
  async function runAction(id: string, args: Record<string, unknown>) {
    const listener = actions.get(id);
    if (!listener) throw new Error(`Missing action ${id}`);
    return listener(args);
  }
  async function runCondition(
    args: Record<string, unknown>,
    id = "garage_door_state_is",
  ) {
    const listener = conditions.get(id);
    if (!listener) throw new Error(`Missing condition ${id}`);
    return listener(args);
  }
  return { actions, conditions, device, runAction, runCondition };
}

describe("garage Flow cards", () => {
  it.each(["up", "idle", "down"])(
    "routes the %s command through the device capability listener once",
    async (command) => {
      const { device, runAction } = fixture();
      await runAction("set_garage_door_command", { device, command });
      expect(device.hasCapability).toHaveBeenCalledWith(
        "homematic_garage_command",
      );
      expect(device.triggerCapabilityListener).toHaveBeenCalledExactlyOnceWith(
        "homematic_garage_command",
        command,
      );
    },
  );

  it("activates the ventilation capability without allowing a supplied value to change the command", async () => {
    const { device, runAction } = fixture();
    await runAction("activate_garage_ventilation", { device, value: false });
    expect(device.triggerCapabilityListener).toHaveBeenCalledExactlyOnceWith(
      "homematic_garage_ventilation",
      true,
    );
  });

  it.each([undefined, null, true, 1, "OPEN", "stop", "toggle", ""])(
    "rejects invalid command %s before writing",
    async (command) => {
      const { device, runAction } = fixture();
      await expect(
        runAction("set_garage_door_command", { device, command }),
      ).rejects.toThrow("Invalid garage command Flow argument");
      expect(device.triggerCapabilityListener).not.toHaveBeenCalled();
    },
  );

  it.each([
    "set_garage_door_command",
    "activate_garage_ventilation",
    "turn_garage_light_on",
    "turn_garage_light_off",
    "toggle_garage_light",
  ])("rejects unavailable capabilities for %s", async (id) => {
    const { device, runAction } = fixture();
    device.hasCapability.mockReturnValue(false);
    await expect(runAction(id, { device, command: "up" })).rejects.toThrow(
      "Selected device does not support",
    );
    expect(device.triggerCapabilityListener).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    "device",
    {},
    { hasCapability: () => true },
    { triggerCapabilityListener: vi.fn() },
  ])("rejects an invalid action device %s", async (device) => {
    const { runAction } = fixture();
    await expect(
      runAction("set_garage_door_command", { device, command: "up" }),
    ).rejects.toThrow("Selected device does not support");
  });

  it.each([
    "set_garage_door_command",
    "activate_garage_ventilation",
    "turn_garage_light_on",
    "turn_garage_light_off",
    "toggle_garage_light",
  ])("propagates write failures from %s without retries", async (id) => {
    const { device, runAction } = fixture();
    const failure = new Error("Device is unavailable");
    device.getCapabilityValue.mockReturnValue(false);
    device.triggerCapabilityListener.mockRejectedValue(failure);
    await expect(runAction(id, { device, command: "up" })).rejects.toBe(
      failure,
    );
    expect(device.triggerCapabilityListener).toHaveBeenCalledOnce();
  });

  it.each([
    ["turn_garage_light_on", true],
    ["turn_garage_light_off", false],
  ] as const)(
    "%s writes only the native light capability with its explicit value",
    async (id, expected) => {
      const { device, runAction } = fixture();
      device.getCapabilityValue.mockReturnValue(null);
      await runAction(id, { device, value: !expected });
      expect(device.triggerCapabilityListener).toHaveBeenCalledExactlyOnceWith(
        "onoff",
        expected,
      );
      expect(device.getCapabilityValue).not.toHaveBeenCalled();
    },
  );

  it.each([true, false])(
    "toggles a reported light state of %s without sending a door command",
    async (state) => {
      const { device, runAction } = fixture();
      device.getCapabilityValue.mockReturnValue(state);
      await runAction("toggle_garage_light", { device });
      expect(device.getCapabilityValue).toHaveBeenCalledExactlyOnceWith(
        "onoff",
      );
      expect(device.triggerCapabilityListener).toHaveBeenCalledExactlyOnceWith(
        "onoff",
        !state,
      );
    },
  );

  it.each([true, false])(
    "reports light condition %s without querying the garage position",
    async (state) => {
      const { device, runCondition } = fixture();
      device.getCapabilityValue.mockReturnValue(state);
      await expect(
        runCondition({ device }, "garage_light_is_on"),
      ).resolves.toBe(state);
      expect(device.getCapabilityValue).toHaveBeenCalledExactlyOnceWith(
        "onoff",
      );
      expect(device.triggerCapabilityListener).not.toHaveBeenCalled();
    },
  );

  it.each([null, undefined, "false", "closed", 0, 1])(
    "rejects unknown light state %s for toggle and condition without assuming the light is off",
    async (state) => {
      const { device, runAction, runCondition } = fixture();
      device.getCapabilityValue.mockReturnValue(state);
      await expect(
        runAction("toggle_garage_light", { device }),
      ).rejects.toThrow("Garage light state is unknown");
      await expect(
        runCondition({ device }, "garage_light_is_on"),
      ).rejects.toThrow("Garage light state is unknown");
      expect(device.triggerCapabilityListener).not.toHaveBeenCalled();
    },
  );

  it("requires the native light state capability for the light condition", async () => {
    const { device, runCondition } = fixture();
    device.hasCapability.mockImplementation(
      (capability: string) => capability !== "onoff",
    );
    await expect(
      runCondition({ device }, "garage_light_is_on"),
    ).rejects.toThrow("Selected device does not support onoff");
    expect(device.getCapabilityValue).not.toHaveBeenCalled();
  });

  it("requires readable light state for a toggle even when command handling exists", async () => {
    const { runAction, device } = fixture();
    await expect(
      runAction("toggle_garage_light", {
        device: {
          hasCapability: device.hasCapability,
          triggerCapabilityListener: device.triggerCapabilityListener,
        },
      }),
    ).rejects.toThrow("Selected device does not support onoff");
    expect(device.triggerCapabilityListener).not.toHaveBeenCalled();
  });

  it.each([
    ["homematic_garage_light", "boolean", "true"],
    ["homematic_garage_light", "boolean", "false"],
    ["homematic_garage_state", "enum", "changed"],
  ] as const)(
    "declares the %s %s capability's automatic %s trigger",
    (capability, type, suffix) => {
      // Homey, not the app controller, dispatches these reserved trigger IDs
      // on setCapabilityValue. This check does not simulate SDK dispatch.
      const definition = JSON.parse(
        readFileSync(`.homeycompose/capabilities/${capability}.json`, "utf8"),
      ) as { type: string; getable: boolean };
      const card = JSON.parse(
        readFileSync(
          `.homeycompose/flow/triggers/${capability}_${suffix}.json`,
          "utf8",
        ),
      ) as {
        args: { name: string; type: string; filter: string }[];
        tokens?: { name: string; type: string }[];
      };
      expect(definition).toMatchObject({ type, getable: true });
      expect(card.args).toEqual([
        expect.objectContaining({
          name: "device",
          type: "device",
          filter: `driver_id=HmIP-MOD-HO|openccu-generic&capabilities=${capability}`,
        }),
      ]);
      if (type === "enum") {
        expect(card.tokens).toEqual([
          expect.objectContaining({ name: capability, type: "string" }),
        ]);
      }
    },
  );

  it.each(["closed", "open", "ventilation", "unknown"])(
    "compares the reported %s state without actuating the door",
    async (reported) => {
      const { device, runCondition } = fixture();
      device.getCapabilityValue.mockReturnValue(reported);
      for (const expected of ["closed", "open", "ventilation", "unknown"]) {
        await expect(runCondition({ device, state: expected })).resolves.toBe(
          reported === expected,
        );
      }
      expect(device.getCapabilityValue).toHaveBeenCalledWith(
        "homematic_garage_state",
      );
      expect(device.triggerCapabilityListener).not.toHaveBeenCalled();
    },
  );

  it.each([null, undefined])(
    "does not confuse missing state %s with an explicitly reported unknown position",
    async (reported) => {
      const { device, runCondition } = fixture();
      device.getCapabilityValue.mockReturnValue(reported);
      for (const state of ["closed", "open", "ventilation", "unknown"]) {
        await expect(runCondition({ device, state })).resolves.toBe(false);
      }
    },
  );

  it.each([undefined, null, true, 0, "CLOSED", "moving", ""])(
    "rejects invalid state argument %s before reading",
    async (state) => {
      const { device, runCondition } = fixture();
      await expect(runCondition({ device, state })).rejects.toThrow(
        "Invalid garage state Flow argument",
      );
      expect(device.getCapabilityValue).not.toHaveBeenCalled();
      expect(device.triggerCapabilityListener).not.toHaveBeenCalled();
    },
  );

  it("rejects unavailable state capabilities", async () => {
    const { device, runCondition } = fixture();
    device.hasCapability.mockReturnValue(false);
    await expect(runCondition({ device, state: "closed" })).rejects.toThrow(
      "Selected device does not support homematic_garage_state",
    );
    expect(device.getCapabilityValue).not.toHaveBeenCalled();
  });

  it.each([undefined, null, {}, { hasCapability: () => true }])(
    "rejects invalid condition device %s",
    async (device) => {
      const { runCondition } = fixture();
      await expect(runCondition({ device, state: "closed" })).rejects.toThrow(
        "Selected device does not support",
      );
    },
  );
});
