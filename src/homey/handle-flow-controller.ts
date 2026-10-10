const CAPABILITY = "homematic_rhs_state";
const CONDITIONS = {
  handle_is_closed: "0",
  handle_is_tilted: "1",
  handle_is_open: "2",
} as const;

interface HandleDevice {
  hasCapability(capability: string): boolean;
  getCapabilityValue(capability: string): unknown;
}

interface HandleFlowManager {
  getConditionCard(id: string): {
    registerRunListener(
      listener: (args: Readonly<Record<string, unknown>>) => Promise<boolean>,
    ): unknown;
  };
}

export function registerHandleFlowCards(flow: HandleFlowManager): void {
  for (const [id, expected] of Object.entries(CONDITIONS)) {
    flow.getConditionCard(id).registerRunListener((args) => {
      const device = args.device;
      if (!isHandleDevice(device) || !device.hasCapability(CAPABILITY)) {
        throw new Error("Selected device does not support handle state");
      }
      const state = device.getCapabilityValue(CAPABILITY);
      // Reject missing/invalid state so inverted conditions cannot pass either.
      if (state !== "0" && state !== "1" && state !== "2") {
        throw new Error("Handle state is unknown");
      }
      return Promise.resolve(state === expected);
    });
  }
}

function isHandleDevice(value: unknown): value is HandleDevice {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<HandleDevice>;
  return (
    typeof candidate.hasCapability === "function" &&
    typeof candidate.getCapabilityValue === "function"
  );
}
