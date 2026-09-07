import type { ConnectionState } from "../protocol/connection-supervisor";
import type { OpenCcuMetadata } from "../domain/model";
import type { XmlRpcDeviceUpdate, XmlRpcEvent } from "../protocol/xmlrpc/types";

export interface OpenCcuEvents {
  readonly metadata: OpenCcuMetadata;
  readonly connection: {
    readonly interfaceId: string;
    readonly state: ConnectionState;
    readonly error?: unknown;
  };
  readonly datapoint: XmlRpcEvent;
  readonly devicesChanged: {
    readonly interfaceId: string;
    readonly reason: "delete" | "new" | "update";
  };
  readonly deviceUpdated: XmlRpcDeviceUpdate;
  readonly [key: string]: unknown;
}
