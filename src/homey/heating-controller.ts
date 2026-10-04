import { createHash } from "node:crypto";
import {
  HeatingError,
  type HeatingSchedule,
  type HeatingSaveResult,
  type HeatingTarget,
} from "../heating/types";
import { findHeatingChannel } from "../heating/discovery";
import type { OpenCcuRuntimeProvider } from "./runtime-provider";

export interface HeatingDevicePort {
  getData(): unknown;
  getName(): string;
  getStoreValue(key: string): unknown;
  hasCapability(capability: string): boolean;
}

interface DeviceIdentity {
  readonly centralId: string;
  readonly interfaceId: string;
  readonly address: string;
}

export interface HeatingRepairSession {
  setHandler(
    event: string,
    handler: (data: unknown) => Promise<unknown>,
  ): unknown;
}

export class HeatingController {
  constructor(
    private readonly devices: () => readonly HeatingDevicePort[],
    private readonly provider: () => OpenCcuRuntimeProvider | undefined,
  ) {}

  listTargets(): readonly HeatingTarget[] {
    const targets = new Map<string, HeatingTarget>();
    for (const device of this.devices()) {
      const target = this.describe(device);
      if (target) targets.set(target.id, target);
    }
    return [...targets.values()].sort(
      (a, b) =>
        Number(b.isGroup) - Number(a.isGroup) || a.name.localeCompare(b.name),
    );
  }

  targetForDevice(device: HeatingDevicePort): HeatingTarget {
    if (!this.devices().includes(device))
      throw new HeatingError("HEATING_UNAVAILABLE");
    const target = this.describe(device);
    if (!target) throw new HeatingError("HEATING_UNSUPPORTED");
    return target;
  }

  async read(targetId: unknown): Promise<HeatingSchedule> {
    return this.readDevice(this.requireDevice(targetId));
  }

  async save(targetId: unknown, request: unknown): Promise<HeatingSaveResult> {
    return this.saveDevice(this.requireDevice(targetId), request);
  }

  async readDevice(device: HeatingDevicePort): Promise<HeatingSchedule> {
    this.targetForDevice(device);
    const { runtime, identity } = this.resolve(device);
    return runtime.readHeatingSchedule(identity.address);
  }

  async saveDevice(
    device: HeatingDevicePort,
    request: unknown,
  ): Promise<HeatingSaveResult> {
    this.targetForDevice(device);
    const { runtime, identity } = this.resolve(device);
    return runtime.saveHeatingSchedule(identity.address, request);
  }

  private describe(device: HeatingDevicePort): HeatingTarget | undefined {
    const identity = parseIdentity(device.getData());
    if (!identity || !device.hasCapability("target_temperature"))
      return undefined;
    const runtime = this.provider()?.get(
      identity.centralId,
      identity.interfaceId,
    );
    const discovered = runtime?.devices.get(identity.address);
    if (discovered && !findHeatingChannel(discovered)) return undefined;
    const storedType = device.getStoreValue("deviceType");
    const model =
      discovered?.type ?? (typeof storedType === "string" ? storedType : "");
    return {
      id: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
      name: device.getName(),
      model,
      isGroup: model.toUpperCase() === "HMIP-HEATING",
    };
  }

  private requireDevice(id: unknown): HeatingDevicePort {
    if (typeof id !== "string" || !/^[a-f0-9]{64}$/.test(id)) {
      throw new HeatingError("HEATING_INVALID");
    }
    const device = this.devices().find(
      (candidate) => this.describe(candidate)?.id === id,
    );
    if (!device) throw new HeatingError("HEATING_UNAVAILABLE");
    return device;
  }

  private resolve(device: HeatingDevicePort) {
    const identity = parseIdentity(device.getData());
    if (!identity) throw new HeatingError("HEATING_UNSUPPORTED");
    const runtime = this.provider()?.get(
      identity.centralId,
      identity.interfaceId,
    );
    if (!runtime) throw new HeatingError("HEATING_UNAVAILABLE");
    return { runtime, identity };
  }
}

/** Bind a repair session to its supplied device; browser data cannot select another. */
export function registerHeatingRepair(
  session: HeatingRepairSession,
  device: HeatingDevicePort,
  controller: HeatingController,
): void {
  session.setHandler("heating:target", () =>
    Promise.resolve().then(() => controller.targetForDevice(device)),
  );
  session.setHandler("heating:read", () => controller.readDevice(device));
  session.setHandler("heating:save", (request) =>
    controller.saveDevice(device, request),
  );
}

function parseIdentity(value: unknown): DeviceIdentity | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.logicalId !== undefined ||
    typeof candidate.centralId !== "string" ||
    !candidate.centralId ||
    typeof candidate.interfaceId !== "string" ||
    !["HmIP-RF", "VirtualDevices"].includes(candidate.interfaceId) ||
    typeof candidate.address !== "string" ||
    !candidate.address
  )
    return undefined;
  return {
    centralId: candidate.centralId,
    interfaceId: candidate.interfaceId,
    address: candidate.address,
  };
}
