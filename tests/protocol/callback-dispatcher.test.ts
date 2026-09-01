import { describe, expect, it, vi } from "vitest";

import { XmlRpcCallbackDispatcher } from "../../src/protocol/xmlrpc/callback-dispatcher";

describe("XmlRpcCallbackDispatcher", () => {
  it("normalizes direct and batched push events", async () => {
    const onEvent = vi.fn();
    const dispatcher = new XmlRpcCallbackDispatcher({ onEvent });
    await dispatcher.dispatch("event", ["hmip", "001:1", "STATE", true]);
    await dispatcher.dispatch("system.multicall", [
      [{ methodName: "event", params: ["hmip", "001:2", "LEVEL", 0.5] }],
    ]);
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenLastCalledWith({
      interfaceId: "hmip",
      channelAddress: "001:2",
      parameter: "LEVEL",
      value: 0.5,
    });
  });

  it("rejects malformed events", async () => {
    await expect(
      new XmlRpcCallbackDispatcher({}).dispatch("event", ["short"]),
    ).rejects.toMatchObject({
      code: "invalid-response",
    });
  });
});
