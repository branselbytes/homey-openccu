import { describe, expect, it, vi } from "vitest";

import {
  HmIpXmlRpcClient,
  type RawXmlRpcClient,
} from "../../src/protocol/xmlrpc/client";

class FakeRawClient implements RawXmlRpcClient {
  readonly calls: Array<{ method: string; params: readonly unknown[] }> = [];
  response: unknown = undefined;
  error: unknown = undefined;

  methodCall(
    method: string,
    params: readonly never[],
    callback: (error: unknown, value?: unknown) => void,
  ): void {
    this.calls.push({ method, params });
    callback(this.error, this.response);
  }
}

describe("HmIpXmlRpcClient", () => {
  it("uses HmIP XML-RPC methods for discovery, reads, writes and registration", async () => {
    const raw = new FakeRawClient();
    const client = new HmIpXmlRpcClient(raw);
    raw.response = [{ ADDRESS: "001:1", TYPE: "SWITCH" }];
    await expect(client.listDevices()).resolves.toHaveLength(1);
    raw.response = true;
    await client.getValue("001:1", "STATE");
    await client.setValue("001:1", "STATE", true);
    await client.putParamset("001:1", "VALUES", { STATE: false });
    await client.init("http://homey:1234", "openccu-hmip");
    expect(raw.calls.map(({ method }) => method)).toEqual([
      "listDevices",
      "getValue",
      "setValue",
      "putParamset",
      "init",
    ]);
  });

  it("classifies malformed discovery responses", async () => {
    const raw = new FakeRawClient();
    raw.response = {};
    await expect(new HmIpXmlRpcClient(raw).listDevices()).rejects.toMatchObject(
      {
        code: "invalid-response",
      },
    );
  });

  it("allows writes more time than reads", async () => {
    vi.useFakeTimers();
    try {
      const raw: RawXmlRpcClient = {
        methodCall: (_method, _params, callback) => {
          setTimeout(() => callback(null, undefined), 15);
        },
      };
      const client = new HmIpXmlRpcClient(raw, {
        timeoutMs: 10,
        writeTimeoutMs: 20,
      });

      const read = client.getValue("001:1", "STATE");
      const readExpectation = expect(read).rejects.toMatchObject({ code: "timeout" });
      await vi.advanceTimersByTimeAsync(10);
      await readExpectation;

      const write = client.setValue("001:1", "STATE", true);
      await vi.advanceTimersByTimeAsync(15);
      await expect(write).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
