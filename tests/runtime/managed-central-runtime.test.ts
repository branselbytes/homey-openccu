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
      "HmIP-RF",
      "connecting",
      undefined,
    );
    expect(onConnectionState).toHaveBeenCalledWith(
      "ccu-1",
      "HmIP-RF",
      "healthy",
      undefined,
    );
    expect(onConnectionState).toHaveBeenLastCalledWith(
      "ccu-1",
      "HmIP-RF",
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

  it("runs VirtualDevices independently on its own endpoint and callback", async () => {
    const primary = createClient();
    const virtual = createClient();
    const callbackPorts: number[] = [];
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: "192.0.2.20",
      enableVirtualDevices: true,
      createClient: () => primary.client,
      createVirtualDevicesClient: () => virtual.client,
      createCallbackServer: ({ port }: { readonly port: number }) => {
        callbackPorts.push(port);
        return {
          ready: vi.fn().mockResolvedValue(undefined),
          close: vi.fn().mockResolvedValue(undefined),
        };
      },
      initialRetryDelayMs: 1,
      maxRetryDelayMs: 1,
    });

    const runtime = await factory.create(
      parseOpenCcuSettings({ centralId: "ccu-1", host: "openccu.local" }),
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(runtime.interfaceCores().map(([id]) => id)).toEqual([
      "HmIP-RF",
      "VirtualDevices",
    ]);
    expect(callbackPorts).toEqual([12010, 12011]);
    expect(primary.init).toHaveBeenCalledWith(
      "http://192.0.2.20:12010",
      "HmIP-RF",
      expect.any(AbortSignal),
    );
    expect(virtual.init).toHaveBeenCalledWith(
      "http://192.0.2.20:12011",
      "VirtualDevices",
      expect.any(AbortSignal),
    );

    await runtime.stop();
  });

  it("keeps HmIP-RF healthy when VirtualDevices discovery is offline", async () => {
    const primary = createClient();
    const virtual = createClient();
    virtual.listDevices.mockRejectedValue(new Error("virtual offline"));
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: "192.0.2.20",
      enableVirtualDevices: true,
      createClient: () => primary.client,
      createVirtualDevicesClient: () => virtual.client,
      createCallbackServer: () => ({
        ready: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      initialRetryDelayMs: 1,
      maxRetryDelayMs: 1,
    });

    const runtime = await factory.create(
      parseOpenCcuSettings({ centralId: "ccu-1", host: "openccu.local" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(runtime.core.connectionState).toBe("healthy");
    expect(runtime.getCore("VirtualDevices")?.connectionState).toBe(
      "disconnected",
    );
    await runtime.stop();
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

describe("optional classic Homematic transport", () => {
  it.each([false, true])(
    "creates BidCos-RF only when enabled=%s and closes every callback",
    async (enableBidCosRf) => {
      const primary = createClient();
      const classic = createClient();
      const createBidCosRfClient = vi.fn(() => classic.client);
      const servers: { port: number; close: ReturnType<typeof vi.fn> }[] = [];
      const factory = new ManagedCentralRuntimeFactory({
        callbackAdvertisedHost: "192.0.2.20",
        createClient: () => primary.client,
        createBidCosRfClient,
        createCallbackServer: ({ port }) => {
          const close = vi.fn().mockResolvedValue(undefined);
          servers.push({ port, close });
          return { ready: () => Promise.resolve(), close };
        },
      });
      const runtime = await factory.create(
        parseOpenCcuSettings({
          centralId: "ccu",
          host: "openccu.local",
          enableBidCosRf,
        }),
      );
      try {
        await new Promise((resolve) => setImmediate(resolve));
        expect(createBidCosRfClient).toHaveBeenCalledTimes(
          enableBidCosRf ? 1 : 0,
        );
        expect(servers.map((s) => s.port)).toEqual(
          enableBidCosRf ? [12010, 12012] : [12010],
        );
        if (enableBidCosRf) {
          expect(classic.init).toHaveBeenCalledWith(
            "http://192.0.2.20:12012",
            "BidCos-RF",
            expect.any(AbortSignal),
          );
          expect(runtime.getCore("BidCos-RF")?.connectionState).toBe("healthy");
        }
      } finally {
        await runtime.stop();
      }
      for (const server of servers) expect(server.close).toHaveBeenCalledOnce();
      if (enableBidCosRf)
        expect(classic.init).toHaveBeenLastCalledWith(
          "",
          "BidCos-RF",
          expect.any(AbortSignal),
        );
    },
  );

  it("isolates an unavailable BidCos interface from HmIP and heating groups", async () => {
    const primary = createClient();
    const virtual = createClient();
    const classic = createClient();
    classic.listDevices.mockRejectedValue(new Error("classic offline"));
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: "192.0.2.20",
      enableVirtualDevices: true,
      createClient: () => primary.client,
      createVirtualDevicesClient: () => virtual.client,
      createBidCosRfClient: () => classic.client,
      createCallbackServer: () => ({
        ready: () => Promise.resolve(),
        close: () => Promise.resolve(),
      }),
      initialRetryDelayMs: 1,
      maxRetryDelayMs: 1,
    });
    const runtime = await factory.create(
      parseOpenCcuSettings({
        centralId: "ccu",
        host: "openccu.local",
        enableBidCosRf: true,
      }),
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(runtime.core.connectionState).toBe("healthy");
      expect(runtime.getCore("VirtualDevices")?.connectionState).toBe(
        "healthy",
      );
      expect(runtime.getCore("BidCos-RF")?.connectionState).toBe(
        "disconnected",
      );
    } finally {
      await runtime.stop();
    }
  });

  it("cleans up all callback servers when an additional listener cannot start", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const factory = new ManagedCentralRuntimeFactory({
      callbackAdvertisedHost: "192.0.2.20",
      createClient: () => createClient().client,
      createBidCosRfClient: () => createClient().client,
      createCallbackServer: ({ interfaceId }) => ({
        ready: () =>
          interfaceId === "BidCos-RF"
            ? Promise.reject(new Error("port occupied"))
            : Promise.resolve(),
        close,
      }),
    });
    await expect(
      factory.create(
        parseOpenCcuSettings({
          centralId: "ccu",
          host: "openccu.local",
          enableBidCosRf: true,
        }),
      ),
    ).rejects.toThrow("port occupied");
    expect(close).toHaveBeenCalledTimes(2);
  });
});
