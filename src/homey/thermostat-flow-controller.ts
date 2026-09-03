export interface ThermostatFlowDevice {
  hasCapability(capability: string): boolean;
  triggerCapabilityListener(capability: string, value: boolean | string): Promise<unknown>;
}

export interface FlowActionCard {
  registerRunListener(
    listener: (args: Readonly<Record<string, unknown>>) => Promise<unknown>,
  ): unknown;
}

export interface FlowManager {
  getActionCard(id: string): FlowActionCard;
}

export function registerThermostatFlowCards(flow: FlowManager): void {
  registerCapabilityAction(
    flow.getActionCard("set_thermostat_mode"),
    "homematic_thermostat_mode",
    "mode",
  );
  registerCapabilityAction(
    flow.getActionCard("activate_thermostat_boost"),
    "homematic_thermostat_boost",
    true,
  );
  registerCapabilityAction(
    flow.getActionCard("set_thermostat_weekprofile"),
    "homematic_thermostat_weekprofile",
    "profile",
  );
}

function registerCapabilityAction(
  card: FlowActionCard,
  capability: string,
  value: string | boolean,
): void {
  card.registerRunListener(async (args) => {
    const device = args.device;
    if (!isThermostatFlowDevice(device) || !device.hasCapability(capability)) {
      throw new Error(`Selected device does not support ${capability}`);
    }
    const capabilityValue = typeof value === "string" ? args[value] : value;
    if (typeof capabilityValue !== "string" && typeof capabilityValue !== "boolean") {
      throw new TypeError(`Invalid ${capability} Flow argument`);
    }
    return device.triggerCapabilityListener(capability, capabilityValue);
  });
}

function isThermostatFlowDevice(value: unknown): value is ThermostatFlowDevice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ThermostatFlowDevice>;
  return (
    typeof candidate.hasCapability === "function" &&
    typeof candidate.triggerCapabilityListener === "function"
  );
}
