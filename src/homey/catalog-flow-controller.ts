import type { FlowManager } from "./thermostat-flow-controller";
import type { RpcValue } from "../protocol/xmlrpc/types";
interface Device {
  hasCapability(capability: string): boolean;
  triggerCapabilityListener(
    capability: string,
    value: RpcValue,
  ): Promise<unknown>;
}
function device(value: unknown, capability: string): Device {
  const d = value as Partial<Device> | null;
  if (
    !d ||
    typeof d.hasCapability !== "function" ||
    typeof d.triggerCapabilityListener !== "function" ||
    !d.hasCapability(capability)
  )
    throw new Error("Selected device does not support this function");
  return d as Device;
}
export function registerCatalogFlowCards(flow: FlowManager): void {
  const register = (
    id: string,
    resolve: (
      args: Readonly<Record<string, unknown>>,
    ) => readonly [string, RpcValue],
  ) => {
    flow.getActionCard(id).registerRunListener(async (args) => {
      const [capability, value] = resolve(args);
      return device(args.device, capability).triggerCapabilityListener(
        capability,
        value,
      );
    });
  };
  register("set_siren_arming", (args) => {
    if (typeof args.state !== "string" || !/^[0-3]$/.test(args.state))
      throw new TypeError("Invalid arming state");
    return ["homematic_siren_arming", args.state];
  });
  register("set_classic_siren_alarm", (args) => {
    if (
      typeof args.channel !== "string" ||
      !["onoff", "onoff.perimeter", "onoff.interior"].includes(args.channel) ||
      !["on", "off"].includes(String(args.state))
    )
      throw new TypeError("Invalid siren alarm");
    return [args.channel, args.state === "on"];
  });
  register("set_signal_color", (args) => {
    if (
      typeof args.color !== "string" ||
      ![
        "BLACK",
        "BLUE",
        "GREEN",
        "TURQUOISE",
        "RED",
        "PURPLE",
        "YELLOW",
        "WHITE",
      ].includes(args.color)
    )
      throw new TypeError("Invalid signal colour");
    return ["homematic_signal_color", args.color];
  });
  register("set_display_line", (args) => {
    if (
      typeof args.line !== "string" ||
      !/^[1-5]$/.test(args.line) ||
      typeof args.text !== "string" ||
      !/^[\x20-\x7e]{0,16}$/.test(args.text)
    )
      throw new TypeError(
        "Display text requires up to 16 printable ASCII characters and a valid line",
      );
    return [`homematic_display_text.line${args.line}`, args.text];
  });
  register("play_sound_file", (args) => {
    if (
      typeof args.file !== "number" ||
      !Number.isInteger(args.file) ||
      args.file < 0 ||
      args.file > 252
    )
      throw new TypeError("Invalid sound file");
    return ["homematic_sound_file", args.file];
  });
  register("stop_sound_file", () => ["button.stop", true]);
}
