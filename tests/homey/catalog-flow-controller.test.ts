import { describe, expect, it, vi } from "vitest";
import { registerCatalogFlowCards } from "../../src/homey/catalog-flow-controller";
function setup() {
  const listeners = new Map<
    string,
    (args: Readonly<Record<string, unknown>>) => Promise<unknown>
  >();
  registerCatalogFlowCards({
    getActionCard: (id) => ({
      registerRunListener: (fn) => listeners.set(id, fn),
    }),
  });
  const device = {
    hasCapability: vi.fn(() => true),
    triggerCapabilityListener: vi.fn().mockResolvedValue(undefined),
  };
  return { listeners, device };
}
describe("catalog Flow actions", () => {
  it.each([
    ["set_siren_arming", { state: "2" }, "homematic_siren_arming", "2"],
    [
      "set_classic_siren_alarm",
      { channel: "onoff.interior", state: "off" },
      "onoff.interior",
      false,
    ],
    ["set_signal_color", { color: "GREEN" }, "homematic_signal_color", "GREEN"],
    [
      "set_display_line",
      { line: "5", text: "Garage closed" },
      "homematic_display_text.line5",
      "Garage closed",
    ],
    ["play_sound_file", { file: 12 }, "homematic_sound_file", 12],
    ["stop_sound_file", {}, "button.stop", true],
  ] as const)(
    "routes %s to its distinct function",
    async (id, args, cap, value) => {
      const { listeners, device } = setup();
      await listeners.get(id)!({ device, ...args });
      expect(device.triggerCapabilityListener).toHaveBeenCalledWith(cap, value);
      device.hasCapability.mockReturnValue(false);
      await expect(listeners.get(id)!({ device, ...args })).rejects.toThrow();
      expect(device.triggerCapabilityListener).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    ["set_siren_arming", { state: "4" }],
    ["set_classic_siren_alarm", { channel: "arbitrary", state: "on" }],
    ["set_signal_color", { color: "unknown" }],
    ["set_display_line", { line: "6", text: "x" }],
    ["set_display_line", { line: "1", text: "ä" }],
    ["set_display_line", { line: "1", text: "01234567890123456X" }],
    ["play_sound_file", { file: -1 }],
    ["play_sound_file", { file: 1.5 }],
  ] as const)(
    "rejects invalid %s arguments before device writes",
    async (id, args) => {
      const { listeners, device } = setup();
      await expect(listeners.get(id)!({ device, ...args })).rejects.toThrow();
      expect(device.triggerCapabilityListener).not.toHaveBeenCalled();
    },
  );
});
