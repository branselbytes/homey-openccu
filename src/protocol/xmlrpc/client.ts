import { ProtocolError, toProtocolError } from "../errors";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClientDiagnostics,
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
  readonly maxConcurrentRequests?: number;
}

type RequestPriority = "normal" | "high";

interface QueuedRequest {
  readonly priority: RequestPriority;
  readonly resolve: (release: () => void) => void;
  readonly reject: (error: unknown) => void;
  readonly signal?: AbortSignal;
  readonly onAbort?: () => void;
}

export class HmIpXmlRpcClient implements XmlRpcClient {
  readonly #rawClient: RawXmlRpcClient;
  readonly #timeoutMs: number;
  readonly #writeTimeoutMs: number;
  readonly #maxConcurrentRequests: number;
  readonly #queue: QueuedRequest[] = [];
  #activeRequests = 0;
  #totalRequests = 0;
  #completedRequests = 0;
  #failedRequests = 0;
  #timedOutRequests = 0;

  constructor(rawClient: RawXmlRpcClient, options: HmIpXmlRpcClientOptions = {}) {
    this.#rawClient = rawClient;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#writeTimeoutMs = options.writeTimeoutMs ?? 20_000;
    this.#maxConcurrentRequests = options.maxConcurrentRequests ?? 2;
    if (!Number.isInteger(this.#maxConcurrentRequests) || this.#maxConcurrentRequests < 1) {
      throw new RangeError("XML-RPC maxConcurrentRequests must be a positive integer");
    }
  }

  getDiagnostics(): XmlRpcClientDiagnostics {
    return {
      activeRequests: this.#activeRequests,
      queuedRequests: this.#queue.length,
      totalRequests: this.#totalRequests,
      completedRequests: this.#completedRequests,
      failedRequests: this.#failedRequests,
      timedOutRequests: this.#timedOutRequests,
    };
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

  async getParamset(
    address: string,
    paramsetKey = "VALUES",
    signal?: AbortSignal,
  ): Promise<Readonly<Record<string, RpcValue>>> {
    const result = await this.#call("getParamset", [address, paramsetKey], signal);
    if (!isRecord(result)) {
      throw new ProtocolError("invalid-response", "XML-RPC getParamset did not return an object");
    }
    return result as Readonly<Record<string, RpcValue>>;
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
      "high",
    );
  }

  async putParamset(
    address: string,
    paramsetKey: string,
    values: Readonly<Record<string, RpcValue>>,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.#call("putParamset", [address, paramsetKey, values], signal, this.#writeTimeoutMs, "high");
  }

  async init(callbackUrl: string, interfaceId: string, signal?: AbortSignal): Promise<void> {
    await this.#call("init", [callbackUrl, interfaceId], signal, this.#timeoutMs, "high");
  }

  async #call(
    method: string,
    params: readonly RpcValue[],
    signal?: AbortSignal,
    timeoutMs = this.#timeoutMs,
    priority: RequestPriority = "normal",
  ): Promise<unknown> {
    if (signal?.aborted) throw new ProtocolError("aborted", `XML-RPC ${method} was aborted`);

    const release = await this.#acquire(priority, signal, method);
    this.#totalRequests += 1;
    try {
      const result = await this.#invoke(method, params, signal, timeoutMs);
      this.#completedRequests += 1;
      return result;
    } catch (error) {
      this.#failedRequests += 1;
      if (error instanceof ProtocolError && error.code === "timeout") {
        this.#timedOutRequests += 1;
      }
      throw error;
    } finally {
      release();
    }
  }

  async #invoke(
    method: string,
    params: readonly RpcValue[],
    signal: AbortSignal | undefined,
    timeoutMs: number,
  ): Promise<unknown> {

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

  async #acquire(
    priority: RequestPriority,
    signal: AbortSignal | undefined,
    method: string,
  ): Promise<() => void> {
    if (this.#activeRequests < this.#maxConcurrentRequests) {
      this.#activeRequests += 1;
      return this.#createRelease();
    }
    return new Promise<() => void>((resolve, reject) => {
      const onAbort = (): void => {
        const index = this.#queue.indexOf(request);
        if (index !== -1) this.#queue.splice(index, 1);
        reject(new ProtocolError("aborted", `XML-RPC ${method} was aborted`));
      };
      const request: QueuedRequest = { priority, resolve, reject, signal, onAbort };
      signal?.addEventListener("abort", onAbort, { once: true });
      const firstNormal = this.#queue.findIndex((queued) => queued.priority === "normal");
      if (priority === "high" && firstNormal !== -1) this.#queue.splice(firstNormal, 0, request);
      else this.#queue.push(request);
    });
  }

  #createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.#queue.shift();
      if (next === undefined) {
        this.#activeRequests -= 1;
        return;
      }
      next.signal?.removeEventListener("abort", next.onAbort as () => void);
      next.resolve(this.#createRelease());
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
