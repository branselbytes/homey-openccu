import type { OpenCcuChannel, OpenCcuDataPoint, OpenCcuDevice } from "../domain/model";

export type ValueTransform =
  | "boolean"
  | "identity"
  | "milliamp-to-amp"
  | "ratio-to-percent"
  | "watt-hour-to-kilowatt-hour";

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
