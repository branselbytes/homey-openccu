import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  HmIpXmlRpcClient,
  type RawXmlRpcClient,
} from "../../src/protocol/xmlrpc/client";

const serializer = createRequire(resolve("package.json"))(
  "homematic-xmlrpc/lib/serializer",
) as {
  serializeMethodCall(method: string, params: readonly unknown[]): string;
};

describe("typed XML-RPC configuration parameters", () => {
  it("encodes whole-degree FLOAT temperatures as doubles while end times remain integers", async () => {
    let xml = "";
    const methodCall = vi.fn<RawXmlRpcClient["methodCall"]>(
      (method, parameters, callback) => {
        xml = serializer.serializeMethodCall(method, parameters);
        callback(undefined, "");
      },
    );
    const client = new HmIpXmlRpcClient({ methodCall });
    const values = { P1_TEMPERATURE_MONDAY_1: 21, P1_ENDTIME_MONDAY_1: 1440 };
    await client.putParamset("fixture:1", "MASTER", values, undefined, {
      P1_TEMPERATURE_MONDAY_1: "FLOAT",
      P1_ENDTIME_MONDAY_1: "INTEGER",
    });
    expect(xml).toContain(
      "<name>P1_TEMPERATURE_MONDAY_1</name><value><double>21</double></value>",
    );
    expect(xml).toContain(
      "<name>P1_ENDTIME_MONDAY_1</name><value><int>1440</int></value>",
    );
    expect(values.P1_TEMPERATURE_MONDAY_1).toBe(21);
  });

  it("retains existing untyped callers and propagates failed configuration acknowledgements", async () => {
    const failure = { faultCode: 7, faultString: "private remote text" };
    const methodCall = vi.fn<RawXmlRpcClient["methodCall"]>(
      (_method, _parameters, callback) => callback(failure),
    );
    const client = new HmIpXmlRpcClient({ methodCall });
    const values = { DURATION_VALUE: 30 };
    await expect(
      client.putParamset("fixture:3", "VALUES", values),
    ).rejects.toMatchObject({ code: "remote-fault", faultCode: 7 });
    expect(methodCall.mock.calls[0][1]).toEqual([
      "fixture:3",
      "VALUES",
      values,
    ]);
  });
});
