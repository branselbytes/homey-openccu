import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

import { XmlRpcCallbackDispatcher } from "../../src/protocol/xmlrpc/callback-dispatcher";
import { registerCallbackMethods } from "../../src/protocol/xmlrpc/homematic-adapter";

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
