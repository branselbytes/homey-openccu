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
  async function runCondition(args: Record<string, unknown>) {
    const listener = conditions.get("garage_door_state_is");
    if (!listener) throw new Error("Missing garage state condition");
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

  it.each(["set_garage_door_command", "activate_garage_ventilation"])(
    "rejects unavailable capabilities for %s",
    async (id) => {
      const { device, runAction } = fixture();
      device.hasCapability.mockReturnValue(false);
      await expect(runAction(id, { device, command: "up" })).rejects.toThrow(
        "Selected device does not support",
      );
      expect(device.triggerCapabilityListener).not.toHaveBeenCalled();
    },
  );

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

  it.each(["set_garage_door_command", "activate_garage_ventilation"])(
    "propagates write failures from %s without retries",
    async (id) => {
      const { device, runAction } = fixture();
      const failure = new Error("Device is unavailable");
      device.triggerCapabilityListener.mockRejectedValue(failure);
      await expect(runAction(id, { device, command: "up" })).rejects.toBe(
        failure,
      );
      expect(device.triggerCapabilityListener).toHaveBeenCalledOnce();
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
