import { ProtocolError, toProtocolError } from "../errors";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "./types";

export interface RawXmlRpcClient {
  methodCall(
    method: string,
    params: readonly RpcValue[],
    callback: (error: unknown, value?: unknown) => void,
  ): void;
}

export interface HmIpXmlRpcClientOptions {
  readonly timeoutMs?: number;
  readonly writeTimeoutMs?: number;
}

export class HmIpXmlRpcClient implements XmlRpcClient {
  readonly #rawClient: RawXmlRpcClient;
  readonly #timeoutMs: number;
  readonly #writeTimeoutMs: number;

  constructor(rawClient: RawXmlRpcClient, options: HmIpXmlRpcClientOptions = {}) {
    this.#rawClient = rawClient;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#writeTimeoutMs = options.writeTimeoutMs ?? 20_000;
  }

  async listDevices(signal?: AbortSignal): Promise<readonly DeviceDescription[]> {
    const result = await this.#call("listDevices", [], signal);
    if (!Array.isArray(result)) {
      throw new ProtocolError("invalid-response", "XML-RPC listDevices did not return an array");
    }
    return result as DeviceDescription[];
  }

  async getParamsetDescription(
    address: string,
    paramsetKey = "VALUES",
    signal?: AbortSignal,
  ): Promise<ParamsetDescription> {
    const result = await this.#call("getParamsetDescription", [address, paramsetKey], signal);
    if (!isRecord(result)) {
      throw new ProtocolError(
        "invalid-response",
        "XML-RPC getParamsetDescription did not return an object",
      );
    }
    return result as ParamsetDescription;
  }

  async getValue(address: string, parameter: string, signal?: AbortSignal): Promise<RpcValue> {
    return (await this.#call("getValue", [address, parameter], signal)) as RpcValue;
  }

  async setValue(
    address: string,
    parameter: string,
    value: RpcValue,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.#call(
      "setValue",
      [address, parameter, value],
      signal,
      this.#writeTimeoutMs,
    );
  }

  async putParamset(
    address: string,
    paramsetKey: string,
    values: Readonly<Record<string, RpcValue>>,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.#call("putParamset", [address, paramsetKey, values], signal);
  }

  async init(callbackUrl: string, interfaceId: string, signal?: AbortSignal): Promise<void> {
    await this.#call("init", [callbackUrl, interfaceId], signal);
  }

  async #call(
    method: string,
    params: readonly RpcValue[],
    signal?: AbortSignal,
    timeoutMs = this.#timeoutMs,
  ): Promise<unknown> {
    if (signal?.aborted) throw new ProtocolError("aborted", `XML-RPC ${method} was aborted`);

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        callback();
      };
      const onAbort = (): void =>
        finish(() => reject(new ProtocolError("aborted", `XML-RPC ${method} was aborted`)));
      const timer = setTimeout(() => {
        finish(() => reject(new ProtocolError("timeout", `XML-RPC ${method} timed out`)));
      }, timeoutMs);

      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        this.#rawClient.methodCall(method, params, (error, value) => {
          finish(() => {
            if (error) reject(toProtocolError(error, `XML-RPC ${method}`));
            else resolve(value);
          });
        });
      } catch (error) {
        finish(() => reject(toProtocolError(error, `XML-RPC ${method}`)));
      }
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
