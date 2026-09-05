import { describe, expect, it, vi } from "vitest";

import { discoverHmIpDevices } from "../../src/runtime/discovery";
import type { XmlRpcClient } from "../../src/protocol/xmlrpc/types";

function createClient(): {
  client: XmlRpcClient;
  listDevices: ReturnType<typeof vi.fn>;
  getParamsetDescription: ReturnType<typeof vi.fn>;
} {
  const listDevices = vi.fn().mockResolvedValue([
    { ADDRESS: "301", TYPE: "HmIP-PS", CHILDREN: ["301:0", "301:3"] },
    {
      ADDRESS: "301:0",
      TYPE: "MAINTENANCE",
      PARENT: "301",
      PARAMSETS: ["VALUES"],
    },
    {
      ADDRESS: "301:3",
      TYPE: "SWITCH",
      PARENT: "301",
      PARAMSETS: ["MASTER", "VALUES"],
    },
    {
      ADDRESS: "301:4",
      TYPE: "CONFIG",
      PARENT: "301",
      PARAMSETS: ["MASTER"],
    },
  ]);
  const getParamsetDescription = vi.fn((address: string) => {
    if (address === "301:0") return Promise.reject(new Error("unavailable"));
    return Promise.resolve({
      STATE: { TYPE: "BOOL" as const, OPERATIONS: 7, FLAGS: 1 },
    });
  });
  return {
    listDevices,
    getParamsetDescription,
    client: {
      listDevices,
      getParamsetDescription,
      getValue: vi.fn(),
      getParamset: vi.fn(),
      setValue: vi.fn(),
      putParamset: vi.fn(),
      init: vi.fn(),
    },
  };
}

describe("discoverHmIpDevices", () => {
  it("loads VALUES descriptions and keeps partial results diagnosable", async () => {
    const { client, getParamsetDescription } = createClient();
    const result = await discoverHmIpDevices(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      concurrency: 2,
    });

    expect(getParamsetDescription).toHaveBeenCalledTimes(2);
    expect(result.issues).toEqual([
      { channelAddress: "301:0", message: "unavailable" },
    ]);
    expect(
      result.devices.get("301")?.channels.get("301:3")?.dataPoints.has("STATE"),
    ).toBe(true);
  });

  it("rejects invalid concurrency before accessing the transport", async () => {
    const { client, listDevices } = createClient();
    await expect(
      discoverHmIpDevices(client, {
        centralId: "ccu-1",
        interfaceId: "HmIP-RF",
        concurrency: 0,
      }),
    ).rejects.toThrow(RangeError);
    expect(listDevices).not.toHaveBeenCalled();
  });

  it("reuses cached paramset descriptions", async () => {
    const { client, getParamsetDescription } = createClient();
    const values = new Map<
      string,
      Awaited<ReturnType<typeof client.getParamsetDescription>>
    >();
    const cache = {
      get: vi.fn((key: string) => Promise.resolve(values.get(key))),
      set: vi.fn(
        (
          key: string,
          value: Awaited<ReturnType<typeof client.getParamsetDescription>>,
        ) => {
          values.set(key, value);
          return Promise.resolve();
        },
      ),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    const options = {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      descriptionCache: cache,
    };

    await discoverHmIpDevices(client, options);
    expect(getParamsetDescription).toHaveBeenCalledTimes(2);
    getParamsetDescription.mockClear();

    await discoverHmIpDevices(client, options);
    expect(getParamsetDescription).toHaveBeenCalledTimes(1);
    expect(cache.get).toHaveBeenCalled();
  });

  it("loads and normalizes only requested profile configuration values", async () => {
    const getParamsetDescription = vi.fn(
      (address: string, paramsetKey = "VALUES") => {
        if (paramsetKey === "MASTER") {
          expect(address).toBe("501:0");
          return Promise.resolve({
            DEVICE_OPERATION_MODE: {
              TYPE: "ENUM" as const,
              OPERATIONS: 3,
              FLAGS: 1,
              VALUE_LIST: ["RGB", "RGBW", "2_TUNABLE_WHITE", "4_PWM"],
            },
          });
        }
        return Promise.resolve({
          LEVEL: { TYPE: "FLOAT" as const, OPERATIONS: 7, FLAGS: 1 },
        });
      },
    );
    const getParamset = vi.fn().mockResolvedValue({
      DEVICE_OPERATION_MODE: 3,
      UNREQUESTED: "secret configuration",
    });
    const client: XmlRpcClient = {
      listDevices: vi.fn().mockResolvedValue([
        {
          ADDRESS: "501",
          TYPE: "HmIP-RGBW",
          CHILDREN: ["501:0", "501:1"],
        },
        {
          ADDRESS: "501:0",
          TYPE: "DEVICE_CONFIG",
          PARENT: "501",
          PARAMSETS: ["MASTER"],
        },
        {
          ADDRESS: "501:1",
          TYPE: "DIMMER",
          PARENT: "501",
          PARAMSETS: ["VALUES"],
        },
      ]),
      getParamsetDescription,
      getValue: vi.fn(),
      getParamset,
      setValue: vi.fn(),
      putParamset: vi.fn(),
      init: vi.fn(),
    };

    const result = await discoverHmIpDevices(client, {
      centralId: "ccu-1",
      interfaceId: "HmIP-RF",
      configurationParameters: (deviceType) =>
        deviceType === "HmIP-RGBW"
          ? [{ channel: 0, parameter: "DEVICE_OPERATION_MODE" }]
          : [],
    });

    expect(getParamset).toHaveBeenCalledOnce();
    expect(getParamset).toHaveBeenCalledWith("501:0", "MASTER", undefined);
    expect(result.devices.get("501")?.configuration?.get("501:0")).toEqual({
      DEVICE_OPERATION_MODE: "4_PWM",
    });
  });
});
