import type {
  OpenCcuChannel,
  OpenCcuDataPoint,
  OpenCcuDevice,
} from "../domain/model";

export const VALUE_TRANSFORMS = [
  "activity-state-to-cover-state",
  "boolean",
  "enum-number-to-string",
  "identity",
  "garage-door-state-to-closed",
  "lock-state-to-boolean",
  "milliamp-to-amp",
  "positive-number-to-boolean",
  "ratio-to-percent",
  "smoke-status-to-boolean",
  "watt-hour-to-kilowatt-hour",
] as const;

export type ValueTransform = (typeof VALUE_TRANSFORMS)[number];

export const WRITE_STRATEGIES = [
  "direct",
  "cover-state",
  "garage-closed",
] as const;
export type WriteStrategy = (typeof WRITE_STRATEGIES)[number];

export interface CapabilityBinding {
  readonly capability: string;
  readonly channelAddress: string;
  readonly parameter: string;
  readonly writeChannelAddress?: string;
  readonly writeParameter?: string;
  readonly writeStrategy?: WriteStrategy;
  readonly readable: boolean;
  readonly writable: boolean;
  readonly transform: ValueTransform;
}

export type ButtonPressType = "short" | "long";

export interface ButtonEventBinding {
  readonly channelAddress: string;
  readonly parameter: string;
  readonly button: number;
  readonly pressType: ButtonPressType;
}

export interface MappingContext {
  readonly device: OpenCcuDevice;
  readonly channel: OpenCcuChannel;
  readonly dataPoint: OpenCcuDataPoint;
}
