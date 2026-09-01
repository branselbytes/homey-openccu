import { ProtocolError, toProtocolError } from "../errors";

export interface JsonRpcClientOptions {
  readonly endpoint: URL | string;
  readonly username?: string;
  readonly password?: string;
  readonly timeoutMs?: number;
  readonly fetch?: typeof fetch;
}

interface JsonRpcResponse<T> {
  readonly id?: number;
  readonly result?: T;
  readonly error?: { readonly code?: number; readonly message?: string; readonly data?: unknown };
}

export class OpenCcuJsonRpcClient {
  readonly #endpoint: string;
  readonly #authorization?: string;
  readonly #timeoutMs: number;
  readonly #fetch: typeof fetch;
  #requestId = 0;

  constructor(options: JsonRpcClientOptions) {
    this.#endpoint = options.endpoint.toString();
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#fetch = options.fetch ?? fetch;
    if ((options.username === undefined) !== (options.password === undefined)) {
      throw new ProtocolError("authentication", "JSON-RPC username and password must be set together");
    }
    if (options.username !== undefined) {
      this.#authorization = `Basic ${Buffer.from(`${options.username}:${options.password}`).toString("base64")}`;
    }
  }

  async call<T>(method: string, params: Readonly<Record<string, unknown>> = {}, signal?: AbortSignal): Promise<T> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.#timeoutMs);
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;
    const id = ++this.#requestId;

    try {
      const response = await this.#fetch(this.#endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.#authorization ? { authorization: this.#authorization } : {}),
        },
        body: JSON.stringify({ jsonrpc: "1.1", id, method, params }),
        signal: combinedSignal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new ProtocolError("authentication", "OpenCCU rejected JSON-RPC credentials");
      }
      if (!response.ok) {
        throw new ProtocolError("transport", `JSON-RPC HTTP request failed with status ${response.status}`);
      }
      let payload: JsonRpcResponse<T>;
      try {
        payload = (await response.json()) as JsonRpcResponse<T>;
      } catch (error) {
        throw new ProtocolError("invalid-response", "JSON-RPC response is not valid JSON", error);
      }
      if (payload.error) {
        throw new ProtocolError(
          "remote-fault",
          `JSON-RPC ${method} failed: ${payload.error.message ?? "unknown error"}`,
          payload.error,
        );
      }
      if (!("result" in payload)) {
        throw new ProtocolError("invalid-response", `JSON-RPC ${method} response has no result`);
      }
      return payload.result as T;
    } catch (error) {
      if (timeoutController.signal.aborted && !signal?.aborted) {
        throw new ProtocolError("timeout", `JSON-RPC ${method} timed out`, error);
      }
      throw toProtocolError(error, `JSON-RPC ${method}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export interface OpenCcuSessionOptions {
  readonly client: OpenCcuJsonRpcClient;
  readonly username: string;
  readonly password: string;
}

export class OpenCcuJsonRpcSession {
  readonly #client: OpenCcuJsonRpcClient;
  readonly #username: string;
  readonly #password: string;
  #sessionId?: string;
  #loginPromise?: Promise<string>;

  constructor(options: OpenCcuSessionOptions) {
    this.#client = options.client;
    this.#username = options.username;
    this.#password = options.password;
  }

  async call<T>(
    method: string,
    params: Readonly<Record<string, unknown>> = {},
    signal?: AbortSignal,
  ): Promise<T> {
    const sessionId = await this.#ensureSession(signal);
    return this.#client.call<T>(method, { _session_id_: sessionId, ...params }, signal);
  }

  async renew(signal?: AbortSignal): Promise<void> {
    const sessionId = await this.#ensureSession(signal);
    const renewed = await this.#client.call<boolean>(
      "Session.renew",
      { _session_id_: sessionId },
      signal,
    );
    if (!renewed) {
      this.#sessionId = undefined;
      throw new ProtocolError("authentication", "OpenCCU JSON-RPC session renewal failed");
    }
  }

  async close(signal?: AbortSignal): Promise<void> {
    const sessionId = this.#sessionId;
    this.#sessionId = undefined;
    if (!sessionId) return;
    await this.#client.call("Session.logout", { _session_id_: sessionId }, signal);
  }

  clear(): void {
    this.#sessionId = undefined;
  }

  async #ensureSession(signal?: AbortSignal): Promise<string> {
    if (this.#sessionId) return this.#sessionId;
    this.#loginPromise ??= this.#login(signal);
    try {
      this.#sessionId = await this.#loginPromise;
      return this.#sessionId;
    } finally {
      this.#loginPromise = undefined;
    }
  }

  async #login(signal?: AbortSignal): Promise<string> {
    const sessionId = await this.#client.call<string | false>(
      "Session.login",
      { username: this.#username, password: this.#password },
      signal,
    );
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      throw new ProtocolError("authentication", "OpenCCU JSON-RPC login failed");
    }
    return sessionId;
  }
}
