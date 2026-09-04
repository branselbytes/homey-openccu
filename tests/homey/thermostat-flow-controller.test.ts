import { describe, expect, it, vi } from "vitest";

import { registerThermostatFlowCards } from "../../src/homey/thermostat-flow-controller";

describe("thermostat Flow cards", () => {
  it("routes mode, boost and week-profile actions through capability listeners", async () => {
    const listeners = new Map<
      string,
      (args: Record<string, unknown>) => Promise<unknown>
    >();
    const flow = {
      getActionCard: (id: string) => ({
        registerRunListener: (
          listener: (args: Record<string, unknown>) => Promise<unknown>,
        ) => {
          listeners.set(id, listener);
        },
      }),
    };
    const triggerCapabilityListener = vi.fn().mockResolvedValue(undefined);
    const device = {
      hasCapability: vi.fn().mockReturnValue(true),
      triggerCapabilityListener,
    };

    registerThermostatFlowCards(flow);
    await listeners.get("set_thermostat_mode")?.({ device, mode: "1" });
    await listeners.get("activate_thermostat_boost")?.({ device });
    await listeners.get("set_thermostat_weekprofile")?.({
      device,
      profile: "2",
    });

    expect(triggerCapabilityListener).toHaveBeenNthCalledWith(
      1,
      "homematic_thermostat_mode",
      "1",
    );
    expect(triggerCapabilityListener).toHaveBeenNthCalledWith(
      2,
      "homematic_thermostat_boost",
      true,
    );
    expect(triggerCapabilityListener).toHaveBeenNthCalledWith(
      3,
      "homematic_thermostat_weekprofile",
      "2",
    );
  });
});
