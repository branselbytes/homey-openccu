import { describe, expect, it, vi } from "vitest";

import {
  OpenCcuJsonRpcClient,
  OpenCcuJsonRpcSession,
} from "../../src/protocol/jsonrpc/client";

describe("OpenCcuJsonRpcClient", () => {
  it("sends JSON-RPC with basic authentication and returns the result", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: ["Kitchen"] }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const client = new OpenCcuJsonRpcClient({
      endpoint: "http://openccu/api/homematic.cgi",
      username: "user",
      password: "secret",
      fetch: fetchMock,
    });
    await expect(client.call<string[]>("Room.getAll")).resolves.toEqual([
      "Kitchen",
    ]);
    const request = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(request?.headers).get("authorization")).toBe(
      "Basic dXNlcjpzZWNyZXQ=",
    );
    expect(JSON.parse(request?.body as string)).toMatchObject({
      jsonrpc: "1.1",
      method: "Room.getAll",
    });
  });

  it("classifies authentication and malformed JSON failures", async () => {
    const denied = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 401 }));
    await expect(
      new OpenCcuJsonRpcClient({
        endpoint: "http://openccu",
        fetch: denied,
      }).call("test"),
    ).rejects.toMatchObject({ code: "authentication" });

    const malformed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("not-json", { status: 200 }));
    await expect(
      new OpenCcuJsonRpcClient({
        endpoint: "http://openccu",
        fetch: malformed,
      }).call("test"),
    ).rejects.toMatchObject({ code: "invalid-response" });
  });

  it("deduplicates concurrent login, renews the session and logs out", async () => {
    const methods: string[] = [];
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation((_input, init) => {
        const body = JSON.parse(init?.body as string) as { method: string };
        methods.push(body.method);
        const result = body.method === "Session.login" ? "session-1" : true;
        return Promise.resolve(
          new Response(JSON.stringify({ id: 0, result }), { status: 200 }),
        );
      });
    const session = new OpenCcuJsonRpcSession({
      client: new OpenCcuJsonRpcClient({
        endpoint: "http://openccu",
        fetch: fetchMock,
      }),
      username: "user",
      password: "secret",
    });
    await Promise.all([
      session.call("Program.getAll"),
      session.call("SysVar.getAll"),
    ]);
    await session.renew();
    await session.close();
    expect(methods).toEqual([
      "Session.login",
      "Program.getAll",
      "SysVar.getAll",
      "Session.renew",
      "Session.logout",
    ]);
  });
});
