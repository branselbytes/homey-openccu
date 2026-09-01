import { ProtocolError } from "../protocol/errors";
import type { RpcValue } from "../protocol/xmlrpc/types";
import type { ValueTransform } from "./types";

export function transformFromOpenCcu(transform: ValueTransform, value: RpcValue): RpcValue {
  switch (transform) {
    case "identity":
      return value;
    case "boolean":
      if (value === true || value === 1 || value === "1" || value === "true") return true;
      if (value === false || value === 0 || value === "0" || value === "false") return false;
      throw invalidTransform(transform, value);
    case "milliamp-to-amp":
      return numeric(value, transform) / 1_000;
    case "ratio-to-percent":
      return numeric(value, transform) * 100;
    case "watt-hour-to-kilowatt-hour":
      return numeric(value, transform) / 1_000;
  }
}

export function transformToOpenCcu(transform: ValueTransform, value: RpcValue): RpcValue {
  switch (transform) {
    case "identity":
    case "boolean":
      return value;
    case "milliamp-to-amp":
      return numeric(value, transform) * 1_000;
    case "ratio-to-percent":
      return numeric(value, transform) / 100;
    case "watt-hour-to-kilowatt-hour":
      return numeric(value, transform) * 1_000;
  }
}

function numeric(value: RpcValue, transform: ValueTransform): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw invalidTransform(transform, value);
}

function invalidTransform(transform: ValueTransform, value: RpcValue): ProtocolError {
  return new ProtocolError(
    "invalid-response",
    `Cannot apply ${transform} to ${Array.isArray(value) ? "array" : typeof value}`,
  );
}
