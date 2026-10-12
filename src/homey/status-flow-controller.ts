import {
  STATUS_FLOW_DEFINITIONS,
  type StatusFlowDefinition,
} from "./status-flow-definitions";
export type StatusValue = string | number | boolean;
export function statusDefinition(
  capability: string,
): StatusFlowDefinition | undefined {
  return STATUS_FLOW_DEFINITIONS.find((d) => d.capability === capability);
}
export function validStatus(
  definition: StatusFlowDefinition,
  value: unknown,
): value is StatusValue {
  if (definition.type === "number")
    return typeof value === "number" && Number.isFinite(value);
  if (definition.type === "boolean") return typeof value === "boolean";
  return (
    typeof value === "string" &&
    (definition.values === undefined ||
      definition.values.some((v) => v.id === value))
  );
}
export function statusTokens(
  capability: string,
  value: StatusValue,
  language: string,
  read?: (capability: string) => unknown,
): Record<string, StatusValue> {
  const d = statusDefinition(capability);
  if (!d || !validStatus(d, value)) throw new TypeError("Invalid status value");
  if (capability === "homematic_passage_count") {
    const direction = read?.("homematic_passage_direction");
    return {
      value,
      direction:
        typeof direction === "boolean"
          ? language === "de"
            ? direction
              ? "Ja"
              : "Nein"
            : direction
              ? "Yes"
              : "No"
          : language === "de"
            ? "Unbekannt"
            : "Unknown",
    };
  }
  if (d.type === "number") return { value };
  const label = d.values?.find((v) => v.id === value)?.title;
  return {
    value,
    status: label
      ? language === "de"
        ? (label.de ?? label.en)
        : label.en
      : language === "de"
        ? value
          ? "Ja"
          : "Nein"
        : value
          ? "Yes"
          : "No",
  };
}
interface FlowDevice {
  hasCapability(id: string): boolean;
  getCapabilityValue(id: string): unknown;
  triggerCapabilityListener(id: string, value: boolean): Promise<unknown>;
}
interface FlowCard {
  registerRunListener(
    fn: (args: Readonly<Record<string, unknown>>) => Promise<unknown>,
  ): unknown;
}
interface FlowManager {
  getConditionCard(id: string): FlowCard;
  getActionCard(id: string): FlowCard;
}
function getDevice(value: unknown, capability: string): FlowDevice {
  const d = value as Partial<FlowDevice> | null;
  if (
    !d ||
    typeof d.hasCapability !== "function" ||
    !d.hasCapability(capability)
  )
    throw new Error("Selected device does not support this function");
  return d as FlowDevice;
}
export function registerStatusFlowCards(flow: FlowManager): void {
  for (const d of STATUS_FLOW_DEFINITIONS)
    flow.getConditionCard(d.condition).registerRunListener((args) => {
      const device = getDevice(args.device, d.capability);
      if (typeof device.getCapabilityValue !== "function")
        throw new TypeError("Invalid device");
      const actual = device.getCapabilityValue(d.capability);
      if (!validStatus(d, actual)) throw new Error("Device status is unknown");
      let result: boolean;
      if (d.type === "number") {
        if (
          typeof actual !== "number" ||
          typeof args.value !== "number" ||
          !Number.isFinite(args.value)
        )
          throw new TypeError("Invalid comparison value");
        switch (args.operator) {
          case "eq":
            result = actual === args.value;
            break;
          case "gt":
            result = actual > args.value;
            break;
          case "lt":
            result = actual < args.value;
            break;
          case "gte":
            result = actual >= args.value;
            break;
          case "lte":
            result = actual <= args.value;
            break;
          default:
            throw new TypeError("Invalid comparison");
        }
      } else {
        const expected =
          d.type === "boolean"
            ? args.value === "true"
              ? true
              : args.value === "false"
                ? false
                : undefined
            : args.value;
        if (!validStatus(d, expected))
          throw new TypeError("Invalid expected status");
        result = actual === expected;
      }
      return Promise.resolve(result);
    });
  for (const [id, capability] of [
    ["set_detection_active", "homematic_detection_active"],
    ["deactivate_thermostat_boost", "homematic_thermostat_boost"],
  ])
    flow.getActionCard(id).registerRunListener((args) => {
      const d = getDevice(args.device, capability);
      if (typeof d.triggerCapabilityListener !== "function")
        throw new TypeError("Invalid device");
      if (
        id === "set_detection_active" &&
        args.active !== "true" &&
        args.active !== "false"
      )
        throw new TypeError("Invalid detection state");
      return d.triggerCapabilityListener(
        capability,
        id === "set_detection_active" && args.active === "true",
      );
    });
}
