export type RpcScalar = boolean | number | string | Date | Buffer | null;
export type RpcValue = RpcScalar | RpcValue[] | { [key: string]: RpcValue };

export interface DeviceDescription {
  readonly ADDRESS: string;
  readonly TYPE: string;
  readonly PARENT?: string;
  readonly PARENT_TYPE?: string;
  readonly CHILDREN?: readonly string[];
  readonly PARAMSETS?: readonly string[];
  readonly FIRMWARE?: string;
  readonly AVAILABLE_FIRMWARE?: string;
  readonly UPDATABLE?: boolean;
  readonly [key: string]: RpcValue | readonly string[] | undefined;
}

export type ParameterType = "ACTION" | "BOOL" | "ENUM" | "FLOAT" | "INTEGER" | "STRING";

export interface ParameterDescription {
  readonly TYPE: ParameterType;
  readonly OPERATIONS: number;
  readonly FLAGS: number;
  readonly DEFAULT?: RpcValue;
  readonly MIN?: number;
  readonly MAX?: number;
  readonly UNIT?: string;
  readonly VALUE_LIST?: readonly string[];
  readonly [key: string]: RpcValue | readonly string[] | undefined;
}

export type ParamsetDescription = Readonly<Record<string, ParameterDescription>>;

export interface XmlRpcEvent {
  readonly interfaceId: string;
  readonly channelAddress: string;
  readonly parameter: string;
  readonly value: RpcValue;
}

export interface XmlRpcDeviceUpdate {
  readonly interfaceId: string;
  readonly address: string;
  readonly hint: number;
}

export interface XmlRpcClient {
  listDevices(signal?: AbortSignal): Promise<readonly DeviceDescription[]>;
  getParamsetDescription(
    address: string,
    paramsetKey?: string,
    signal?: AbortSignal,
  ): Promise<ParamsetDescription>;
  getValue(address: string, parameter: string, signal?: AbortSignal): Promise<RpcValue>;
  setValue(address: string, parameter: string, value: RpcValue, signal?: AbortSignal): Promise<void>;
  putParamset(
    address: string,
    paramsetKey: string,
    values: Readonly<Record<string, RpcValue>>,
    signal?: AbortSignal,
  ): Promise<void>;
  init(callbackUrl: string, interfaceId: string, signal?: AbortSignal): Promise<void>;
}
