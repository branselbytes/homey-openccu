import { describe, expect, it, vi } from "vitest";

import { parseOpenCcuSettings } from "../../src/config/openccu-config";
import type { XmlRpcClient } from "../../src/protocol/xmlrpc/types";
import {
  buildCallbackUrl,
  ManagedCentralRuntimeFactory,
} from "../../src/runtime/managed-central-runtime";

function createClient(): {
  client: XmlRpcClient;
  init: ReturnType<typeof vi.fn>;
  listDevices: ReturnType<typeof vi.fn>;
} {
  const init = vi.fn().mockResolvedValue(undefined);
  const listDevices = vi.fn().mockResolvedValue([]);
  return {
    init,
    listDevices,
    client: {
      listDevices,
      getParamsetDescription: vi.fn(),
      getValue: vi.fn(),
      getParamset: vi.fn(),
      setValue: vi.fn(),
      putParamset: vi.fn(),
      init,
    },
  };
}

describe("ManagedCentralRuntimeFactory", () => {
  it("starts callbacks before registering and deregisters during shutdown", async () => {
    const { client, init } = createClient();
    const order: string[] = [];
    const close = vi.fn().mockImplementation(() => {
      order.push("close");
      return Promise.resolve();
    });
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: "192.0.2.20",
      createClient: () => client,
      createCallbackServer: () => ({
        ready: vi.fn().mockImplementation(() => {
          order.push("ready");
          return Promise.resolve();
        }),
        close,
      }),
      initialRetryDelayMs: 1,
      maxRetryDelayMs: 1,
    });
    init.mockImplementation((url: string) => {
      order.push(url === "" ? "deregister" : "register");
      return Promise.resolve();
    });

    const runtime = await factory.create(
      parseOpenCcuSettings({ centralId: "ccu-1", host: "openccu.local" }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    await runtime.stop();

    expect(order).toEqual(["ready", "register", "deregister", "close"]);
    expect(init).toHaveBeenCalledWith(
      "http://192.0.2.20:12010",
      "HmIP-RF",
      expect.any(AbortSignal),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("reports credential-free supervisor states to the host adapter", async () => {
    const { client } = createClient();
    const onConnectionState = vi.fn();
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: "192.0.2.20",
      createClient: () => client,
      createCallbackServer: () => ({ ready: vi.fn(), close: vi.fn() }),
      onConnectionState,
    });
    const runtime = await factory.create(
      parseOpenCcuSettings({ centralId: "ccu-1", host: "openccu.local" }),
    );
    await new Promise((resolve) => setImmediate(resolve));
    await runtime.stop();

    expect(onConnectionState).toHaveBeenCalledWith(
      "ccu-1",
      "connecting",
      undefined,
    );
    expect(onConnectionState).toHaveBeenCalledWith(
      "ccu-1",
      "healthy",
      undefined,
    );
    expect(onConnectionState).toHaveBeenLastCalledWith(
      "ccu-1",
      "stopped",
      undefined,
    );
  });

  it("reports connection transitions while retrying offline", async () => {
    const { client, listDevices } = createClient();
    listDevices.mockRejectedValue(new Error("offline"));
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: "192.0.2.20",
      createClient: () => client,
      createCallbackServer: () => ({ ready: vi.fn(), close: vi.fn() }),
      initialRetryDelayMs: 1,
      maxRetryDelayMs: 1,
    });
    const runtime = await factory.create(
      parseOpenCcuSettings({ centralId: "ccu-1", host: "openccu.local" }),
    );
    const states: string[] = [];
    runtime.core.subscribe("connection", ({ state }) => states.push(state));

    await new Promise((resolve) => setTimeout(resolve, 10));
    await runtime.stop();

    expect(states).toContain("disconnected");
    expect(states.at(-1)).toBe("stopped");
  });
});

describe("buildCallbackUrl", () => {
  it("formats IPv4, host names, and IPv6 callback addresses", () => {
    expect(buildCallbackUrl("homey.local", 12010)).toBe(
      "http://homey.local:12010",
    );
    expect(buildCallbackUrl("2001:db8::1", 12010)).toBe(
      "http://[2001:db8::1]:12010",
    );
  });
});
