import { ProtocolError } from "../protocol/errors";
import type { RpcValue } from "../protocol/xmlrpc/types";
import type { ValueTransform } from "./types";

export function transformFromOpenCcu(
  transform: ValueTransform,
  value: RpcValue,
): RpcValue {
  switch (transform) {
    case "activity-state-to-cover-state":
      if (typeof value !== "string") throw invalidTransform(transform, value);
      if (value === "UP") return "up";
      if (value === "DOWN") return "down";
      return "idle";
    case "identity":
      return value;
    case "boolean":
      if (value === true || value === 1 || value === "1" || value === "true")
        return true;
      if (value === false || value === 0 || value === "0" || value === "false")
        return false;
      throw invalidTransform(transform, value);
    case "enum-number-to-string":
      if (typeof value === "number" && Number.isInteger(value))
        return String(value);
      if (typeof value === "string") return value;
      throw invalidTransform(transform, value);
    case "milliamp-to-amp":
      return numeric(value, transform) / 1_000;
    case "positive-number-to-boolean":
      return numeric(value, transform) > 0;
    case "ratio-to-percent":
      return numeric(value, transform) * 100;
    case "smoke-status-to-boolean":
      if (typeof value === "string") return value !== "IDLE_OFF";
      throw invalidTransform(transform, value);
    case "watt-hour-to-kilowatt-hour":
      return numeric(value, transform) / 1_000;
  }
}

export function transformToOpenCcu(
  transform: ValueTransform,
  value: RpcValue,
): RpcValue {
  switch (transform) {
    case "activity-state-to-cover-state":
      throw invalidTransform(transform, value);
    case "identity":
    case "boolean":
      return value;
    case "enum-number-to-string":
      if (typeof value === "string" && /^-?\d+$/.test(value))
        return Number(value);
      if (typeof value === "number" && Number.isInteger(value)) return value;
      throw invalidTransform(transform, value);
    case "milliamp-to-amp":
      return numeric(value, transform) * 1_000;
    case "positive-number-to-boolean":
      if (typeof value !== "boolean") throw invalidTransform(transform, value);
      return value ? 1 : 0;
    case "ratio-to-percent":
      return numeric(value, transform) / 100;
    case "smoke-status-to-boolean":
      throw invalidTransform(transform, value);
    case "watt-hour-to-kilowatt-hour":
      return numeric(value, transform) * 1_000;
  }
}

function numeric(value: RpcValue, transform: ValueTransform): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw invalidTransform(transform, value);
}

function invalidTransform(
  transform: ValueTransform,
  value: RpcValue,
): ProtocolError {
  return new ProtocolError(
    "invalid-response",
    `Cannot apply ${transform} to ${Array.isArray(value) ? "array" : typeof value}`,
  );
}
