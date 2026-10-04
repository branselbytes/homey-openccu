interface GarageCommandDevice {
  hasCapability(capability: string): boolean;
  triggerCapabilityListener(
    capability: string,
    value: boolean | string,
  ): Promise<unknown>;
}

interface GarageStateDevice {
  hasCapability(capability: string): boolean;
  getCapabilityValue(capability: string): unknown;
}

export interface GarageFlowCard {
  registerRunListener(
    listener: (args: Readonly<Record<string, unknown>>) => Promise<unknown>,
  ): unknown;
}

export interface GarageFlowManager {
  getActionCard(id: string): GarageFlowCard;
  getConditionCard(id: string): GarageFlowCard;
}

export function registerGarageFlowCards(flow: GarageFlowManager): void {
  flow
    .getActionCard("set_garage_door_command")
    .registerRunListener(async (args) => {
      const capability = "homematic_garage_command";
      const device = requireCommandDevice(args.device, capability);
      if (
        args.command !== "up" &&
        args.command !== "idle" &&
        args.command !== "down"
      ) {
        throw new TypeError("Invalid garage command Flow argument");
      }
      return device.triggerCapabilityListener(capability, args.command);
    });

  flow
    .getActionCard("activate_garage_ventilation")
    .registerRunListener(async (args) => {
      const capability = "homematic_garage_ventilation";
      const device = requireCommandDevice(args.device, capability);
      return device.triggerCapabilityListener(capability, true);
    });

  for (const [id, value] of [
    ["turn_garage_light_on", true],
    ["turn_garage_light_off", false],
  ] as const) {
    flow.getActionCard(id).registerRunListener(async (args) => {
      const device = requireCommandDevice(args.device, "onoff");
      return device.triggerCapabilityListener("onoff", value);
    });
  }

  flow
    .getActionCard("toggle_garage_light")
    .registerRunListener(async (args) => {
      const device = requireCommandDevice(args.device, "onoff");
      const current = readGarageLightState(device);
      return device.triggerCapabilityListener("onoff", !current);
    });

  flow
    .getConditionCard("garage_light_is_on")
    .registerRunListener((args) =>
      Promise.resolve(readGarageLightState(args.device)),
    );

  flow.getConditionCard("garage_door_state_is").registerRunListener((args) => {
    const capability = "homematic_garage_state";
    const device = args.device;
    if (!isGarageStateDevice(device) || !device.hasCapability(capability)) {
      throw new Error(`Selected device does not support ${capability}`);
    }
    if (
      args.state !== "closed" &&
      args.state !== "open" &&
      args.state !== "ventilation" &&
      args.state !== "unknown"
    ) {
      throw new TypeError("Invalid garage state Flow argument");
    }
    // An explicit report of an unknown position differs from no report yet.
    return Promise.resolve(
      device.getCapabilityValue(capability) === args.state,
    );
  });
}

function readGarageLightState(device: unknown): boolean {
  if (!isGarageStateDevice(device) || !device.hasCapability("onoff")) {
    throw new Error("Selected device does not support onoff");
  }
  const state = device.getCapabilityValue("onoff");
  if (typeof state !== "boolean") {
    throw new Error("Garage light state is unknown");
  }
  return state;
}

function requireCommandDevice(
  value: unknown,
  capability: string,
): GarageCommandDevice {
  if (!isGarageCommandDevice(value) || !value.hasCapability(capability)) {
    throw new Error(`Selected device does not support ${capability}`);
  }
  return value;
}

function isGarageCommandDevice(value: unknown): value is GarageCommandDevice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<GarageCommandDevice>;
  return (
    typeof candidate.hasCapability === "function" &&
    typeof candidate.triggerCapabilityListener === "function"
  );
}

function isGarageStateDevice(value: unknown): value is GarageStateDevice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<GarageStateDevice>;
  return (
    typeof candidate.hasCapability === "function" &&
    typeof candidate.getCapabilityValue === "function"
  );
}
