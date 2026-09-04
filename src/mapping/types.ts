import type {
  OpenCcuChannel,
  OpenCcuDataPoint,
  OpenCcuDevice,
} from "../domain/model";

export const VALUE_TRANSFORMS = [
  "boolean",
  "enum-number-to-string",
  "identity",
  "milliamp-to-amp",
  "ratio-to-percent",
  "smoke-status-to-boolean",
  "watt-hour-to-kilowatt-hour",
] as const;

export type ValueTransform = (typeof VALUE_TRANSFORMS)[number];

export interface CapabilityBinding {
  readonly capability: string;
  readonly channelAddress: string;
  readonly parameter: string;
  readonly writeChannelAddress?: string;
  readonly writeParameter?: string;
  readonly readable: boolean;
  readonly writable: boolean;
  readonly transform: ValueTransform;
}

export interface MappingContext {
  readonly device: OpenCcuDevice;
  readonly channel: OpenCcuChannel;
  readonly dataPoint: OpenCcuDataPoint;
}
