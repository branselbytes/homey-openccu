import { ProtocolError } from "../errors";
import type { DeviceDescription, RpcValue, XmlRpcDeviceUpdate, XmlRpcEvent } from "./types";

export interface XmlRpcCallbackHandlers {
  readonly onEvent?: (event: XmlRpcEvent) => void | Promise<void>;
  readonly onNewDevices?: (
    interfaceId: string,
    devices: readonly DeviceDescription[],
  ) => void | Promise<void>;
  readonly onDeleteDevices?: (interfaceId: string, addresses: readonly string[]) => void | Promise<void>;
  readonly onUpdateDevice?: (update: XmlRpcDeviceUpdate) => void | Promise<void>;
}

export class XmlRpcCallbackDispatcher {
  readonly #handlers: XmlRpcCallbackHandlers;

  constructor(handlers: XmlRpcCallbackHandlers) {
    this.#handlers = handlers;
  }

  async dispatch(method: string, params: readonly unknown[]): Promise<unknown> {
    switch (method) {
      case "event":
        await this.#dispatchEvent(params);
        return "";
      case "system.multicall":
        return this.#dispatchMulticall(params);
      case "newDevices":
        await this.#dispatchNewDevices(params);
        return "";
      case "deleteDevices":
        await this.#dispatchDeleteDevices(params);
        return "";
      case "updateDevice":
        await this.#dispatchUpdateDevice(params);
        return "";
      case "listDevices":
        return [];
      case "system.listMethods":
        return ["event", "system.multicall", "newDevices", "deleteDevices", "updateDevice"];
      default:
        throw new ProtocolError("remote-fault", `Unsupported XML-RPC callback method: ${method}`);
    }
  }

  async #dispatchEvent(params: readonly unknown[]): Promise<void> {
    if (params.length !== 4 || !params.slice(0, 3).every((value) => typeof value === "string")) {
      throw new ProtocolError("invalid-response", "Malformed XML-RPC event callback");
    }
    await this.#handlers.onEvent?.({
      interfaceId: params[0] as string,
      channelAddress: params[1] as string,
      parameter: params[2] as string,
      value: params[3] as RpcValue,
    });
  }

  async #dispatchMulticall(params: readonly unknown[]): Promise<readonly unknown[]> {
    const calls = Array.isArray(params[0]) ? params[0] : undefined;
    if (!calls) throw new ProtocolError("invalid-response", "Malformed XML-RPC multicall");
    const results: unknown[] = [];
    for (const call of calls) {
      if (!isRecord(call) || typeof call.methodName !== "string" || !Array.isArray(call.params)) {
        throw new ProtocolError("invalid-response", "Malformed XML-RPC multicall entry");
      }
      results.push([await this.dispatch(call.methodName, call.params)]);
    }
    return results;
  }

  async #dispatchNewDevices(params: readonly unknown[]): Promise<void> {
    if (typeof params[0] !== "string" || !Array.isArray(params[1])) {
      throw new ProtocolError("invalid-response", "Malformed XML-RPC newDevices callback");
    }
    await this.#handlers.onNewDevices?.(params[0], params[1] as DeviceDescription[]);
  }

  async #dispatchDeleteDevices(params: readonly unknown[]): Promise<void> {
    if (
      typeof params[0] !== "string" ||
      !Array.isArray(params[1]) ||
      !params[1].every((value) => typeof value === "string")
    ) {
      throw new ProtocolError("invalid-response", "Malformed XML-RPC deleteDevices callback");
    }
    await this.#handlers.onDeleteDevices?.(params[0], params[1]);
  }

  async #dispatchUpdateDevice(params: readonly unknown[]): Promise<void> {
    if (
      typeof params[0] !== "string" ||
      typeof params[1] !== "string" ||
      typeof params[2] !== "number"
    ) {
      throw new ProtocolError("invalid-response", "Malformed XML-RPC updateDevice callback");
    }
    await this.#handlers.onUpdateDevice?.({
      interfaceId: params[0],
      address: params[1],
      hint: params[2],
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
