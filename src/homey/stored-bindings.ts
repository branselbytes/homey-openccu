import type { CapabilityBinding, ValueTransform } from "../mapping/types";

const TRANSFORMS: readonly ValueTransform[] = [
  "boolean",
  "identity",
  "milliamp-to-amp",
  "ratio-to-percent",
  "watt-hour-to-kilowatt-hour",
];

export function parseStoredBindings(value: unknown): readonly CapabilityBinding[] {
  if (!Array.isArray(value)) throw new TypeError("Stored OpenCCU bindings must be an array");
  return value.map((binding, index) => parseBinding(binding, index));
}

function parseBinding(value: unknown, index: number): CapabilityBinding {
  if (!isRecord(value)) throw new TypeError(`Stored binding ${index} must be an object`);
  const capability = requiredString(value.capability, index, "capability");
  const channelAddress = requiredString(value.channelAddress, index, "channelAddress");
  const parameter = requiredString(value.parameter, index, "parameter");
  if (typeof value.readable !== "boolean" || typeof value.writable !== "boolean") {
    throw new TypeError(`Stored binding ${index} must define readable and writable booleans`);
  }
  if (typeof value.transform !== "string" || !TRANSFORMS.includes(value.transform as ValueTransform)) {
    throw new TypeError(`Stored binding ${index} has an unsupported transform`);
  }
  const writeChannelAddress = optionalString(value.writeChannelAddress, index, "writeChannelAddress");
  const writeParameter = optionalString(value.writeParameter, index, "writeParameter");
  if (value.writable && (!writeChannelAddress || !writeParameter)) {
    throw new TypeError(`Stored writable binding ${index} has no write target`);
  }
  return {
    capability,
    channelAddress,
    parameter,
    readable: value.readable,
    writable: value.writable,
    transform: value.transform as ValueTransform,
    ...(writeChannelAddress ? { writeChannelAddress } : {}),
    ...(writeParameter ? { writeParameter } : {}),
  };
}

function requiredString(value: unknown, index: number, field: string): string {
  const result = optionalString(value, index, field);
  if (!result) throw new TypeError(`Stored binding ${index} has no ${field}`);
  return result;
}

function optionalString(value: unknown, index: number, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`Stored binding ${index} has an invalid ${field}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
