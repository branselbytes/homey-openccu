import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import { XmlRpcCallbackDispatcher } from "../../src/protocol/xmlrpc/callback-dispatcher";
import {
  authorizeRemoteSocket,
  registerCallbackMethods,
  XmlRpcCallbackServer,
} from "../../src/protocol/xmlrpc/homematic-adapter";

describe("homematic XML-RPC adapter", () => {
  it("registers and acknowledges callback methods", async () => {
    const server = new EventEmitter();
    const onEvent = vi.fn();
    registerCallbackMethods(server, new XmlRpcCallbackDispatcher({ onEvent }));

    const result = await new Promise<unknown>((resolve, reject) => {
      server.emit(
        "event",
        null,
        ["hmip", "001:1", "STATE", true],
        (error: unknown, value: unknown) => {
          if (error)
            reject(
              error instanceof Error
                ? error
                : new Error("Callback failed", { cause: error }),
            );
          else resolve(value);
        },
      );
    });

    expect(result).toBe("");
    expect(onEvent).toHaveBeenCalledOnce();
  });
});

describe("XmlRpcCallbackServer", () => {
  it("exposes an explicit listening barrier", async () => {
    const server = new XmlRpcCallbackServer({
      host: "127.0.0.1",
      port: 0,
      expectedRemoteHost: "127.0.0.1",
      dispatcher: new XmlRpcCallbackDispatcher({}),
    });

    await server.ready();
    await server.close();
  });

  it("accepts only sockets matching the resolved OpenCCU host", async () => {
    const allowedSocket = {
      remoteAddress: "::ffff:192.0.2.5",
      pause: vi.fn(),
      resume: vi.fn(),
      destroy: vi.fn(),
    };
    const deniedSocket = {
      remoteAddress: "192.0.2.99",
      pause: vi.fn(),
      resume: vi.fn(),
      destroy: vi.fn(),
    };
    const resolveHost = vi.fn().mockResolvedValue(new Set(["192.0.2.5"]));

    await expect(
      authorizeRemoteSocket(allowedSocket, "openccu.local", resolveHost),
    ).resolves.toBe(true);
    await expect(
      authorizeRemoteSocket(deniedSocket, "openccu.local", resolveHost),
    ).resolves.toBe(false);

    expect(allowedSocket.pause).toHaveBeenCalledOnce();
    expect(allowedSocket.resume).toHaveBeenCalledOnce();
    expect(allowedSocket.destroy).not.toHaveBeenCalled();
    expect(deniedSocket.pause).toHaveBeenCalledOnce();
    expect(deniedSocket.resume).not.toHaveBeenCalled();
    expect(deniedSocket.destroy).toHaveBeenCalledOnce();
  });
});
