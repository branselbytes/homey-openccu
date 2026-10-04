import { describe, expect, it, vi } from "vitest";
import { buildHmIpDeviceGraph } from "../../src/domain/model";
import {
  HeatingController,
  registerHeatingRepair,
  type HeatingDevicePort,
} from "../../src/homey/heating-controller";
import type { OpenCcuRuntimeProvider } from "../../src/homey/runtime-provider";
import { findHeatingChannel } from "../../src/heating/discovery";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import type { XmlRpcClient } from "../../src/protocol/xmlrpc/types";
import api from "../../api";

function device(
  model = "HmIP-eTRV-2",
  centralId = "central",
  address = "THERMOSTAT",
) {
  const identity: Record<string, unknown> = {
    id: `${centralId}/${address}`,
    centralId,
    address,
    interfaceId: model === "HmIP-HEATING" ? "VirtualDevices" : "HmIP-RF",
  };
  const port: HeatingDevicePort = {
    getData: () => identity,
    getName: () => (model === "HmIP-HEATING" ? "Group" : "Thermostat"),
    getStoreValue: () => model,
    hasCapability: (capability) => capability === "target_temperature",
  };
  return { identity, port };
}

function fixture() {
  const thermostat = device();
  const group = device("HmIP-HEATING", "central", "GROUP");
  const devices = [thermostat.port, group.port];
  const runtime = {
    devices: new Map(),
    readHeatingSchedule: vi.fn().mockResolvedValue({ revision: "read" }),
    saveHeatingSchedule: vi.fn().mockResolvedValue({ status: "confirmed" }),
  };
  const get = vi.fn().mockReturnValue(runtime);
  const controller = new HeatingController(
    () => devices,
    () => ({ get }) as unknown as OpenCcuRuntimeProvider,
  );
  return { thermostat, group, devices, runtime, get, controller };
}

describe("HeatingController", () => {
  it("lists paired thermostat targets with groups first and opaque stable identities without I/O", () => {
    const { controller, runtime } = fixture();
    const targets = controller.listTargets();
    expect(targets.map((target) => target.isGroup)).toEqual([true, false]);
    expect(targets[0]).toMatchObject({ name: "Group", model: "HmIP-HEATING" });
    expect(targets.every((target) => /^[a-f0-9]{64}$/.test(target.id))).toBe(
      true,
    );
    expect(controller.listTargets()).toEqual(targets);
    expect(runtime.readHeatingSchedule).not.toHaveBeenCalled();
  });

  it("keeps the same CCU address on two centrals distinct and resolves the correct interface", async () => {
    const { controller, devices, group, get, runtime } = fixture();
    devices.push(device("HmIP-eTRV-2", "second").port);
    expect(new Set(controller.listTargets().map(({ id }) => id)).size).toBe(3);
    await controller.read(controller.targetForDevice(group.port).id);
    expect(get).toHaveBeenLastCalledWith("central", "VirtualDevices");
    expect(runtime.readHeatingSchedule).toHaveBeenCalledWith("GROUP");
  });

  it("rejects forged identities, deleted devices and logical subdevices without performing a write", async () => {
    const { controller, devices, thermostat, runtime } = fixture();
    await expect(controller.save("THERMOSTAT:1", {})).rejects.toThrow(
      "HEATING_INVALID",
    );
    await expect(controller.save("a".repeat(64), {})).rejects.toThrow(
      "HEATING_UNAVAILABLE",
    );
    const id = controller.targetForDevice(thermostat.port).id;
    devices.splice(devices.indexOf(thermostat.port), 1);
    await expect(controller.save(id, {})).rejects.toThrow(
      "HEATING_UNAVAILABLE",
    );
    expect(() => controller.targetForDevice(thermostat.port)).toThrow(
      "HEATING_UNAVAILABLE",
    );
    const logical = device();
    logical.identity.logicalId = "output-1";
    devices.push(logical.port);
    expect(controller.listTargets()).toHaveLength(1);
    expect(runtime.saveHeatingSchedule).not.toHaveBeenCalled();
  });

  it("shows a paired target during an outage but refuses reads and saves", async () => {
    const { controller, get } = fixture();
    get.mockReturnValue(undefined);
    const [target] = controller.listTargets();
    expect(target).toBeDefined();
    await expect(controller.read(target.id)).rejects.toThrow(
      "HEATING_UNAVAILABLE",
    );
    await expect(controller.save(target.id, {})).rejects.toThrow(
      "HEATING_UNAVAILABLE",
    );
  });

  it("binds repair events to their original device, including after its removal", async () => {
    const { controller, thermostat, devices, runtime } = fixture();
    const handlers = new Map<string, (body: unknown) => Promise<unknown>>();
    registerHeatingRepair(
      { setHandler: (event, handler) => handlers.set(event, handler) },
      thermostat.port,
      controller,
    );
    await handlers.get("heating:read")?.({ targetId: "another device" });
    expect(runtime.readHeatingSchedule).toHaveBeenCalledWith("THERMOSTAT");
    const request = { revision: "r", profile: 1, days: {} };
    await handlers.get("heating:save")?.(request);
    expect(runtime.saveHeatingSchedule).toHaveBeenCalledWith(
      "THERMOSTAT",
      request,
    );
    devices.splice(devices.indexOf(thermostat.port), 1);
    await expect(handlers.get("heating:read")?.(null)).rejects.toThrow(
      "HEATING_UNAVAILABLE",
    );
  });

  it("does not forward arbitrary API body fields or parameter keys", async () => {
    const { controller, runtime } = fixture();
    const homey = {
      app: {
        heatingController: controller,
        generateSupportReport: () => ({}),
        discoverOpenCcus: () => Promise.resolve({}),
      },
    };
    const [target] = controller.listTargets();
    expect(() =>
      api.readHeatingSchedule({
        homey,
        body: { targetId: target.id, address: "OTHER" },
      }),
    ).toThrow("HEATING_INVALID");
    expect(() =>
      api.saveHeatingSchedule({
        homey,
        body: {
          targetId: target.id,
          revision: "r",
          profile: 1,
          days: {},
          putParamset: {},
        },
      }),
    ).toThrow("HEATING_INVALID");
    await api.saveHeatingSchedule({
      homey,
      body: { targetId: target.id, revision: "r", profile: 1, days: {} },
    });
    expect(runtime.saveHeatingSchedule).toHaveBeenCalledWith("GROUP", {
      revision: "r",
      profile: 1,
      days: {},
    });
  });
});

describe("heating runtime boundary", () => {
  const descriptions = [
    { ADDRESS: "FIXTURE", TYPE: "HmIP-HEATING", CHILDREN: ["FIXTURE:1"] },
    {
      ADDRESS: "FIXTURE:1",
      TYPE: "HEATING_CLIMATECONTROL_TRANSCEIVER",
      PARENT: "FIXTURE",
      PARAMSETS: ["VALUES", "MASTER"],
    },
  ];
  const paramsets = {
    SET_POINT_TEMPERATURE: { TYPE: "FLOAT" as const, OPERATIONS: 7, FLAGS: 1 },
    ACTIVE_PROFILE: {
      TYPE: "INTEGER" as const,
      OPERATIONS: 7,
      FLAGS: 1,
      MIN: 1,
      MAX: 3,
    },
  };

  it("discovers candidates by climate datapoints and MASTER support rather than a model name", () => {
    const graph = buildHmIpDeviceGraph({
      centralId: "test",
      interfaceId: "VirtualDevices",
      descriptions,
      paramsets: new Map([["FIXTURE:1", paramsets]]),
    });
    const candidate = graph.get("FIXTURE");
    expect(candidate && findHeatingChannel(candidate)).toBe("FIXTURE:1");
    const noMaster = buildHmIpDeviceGraph({
      centralId: "test",
      interfaceId: "VirtualDevices",
      descriptions: [
        descriptions[0],
        { ...descriptions[1], PARAMSETS: ["VALUES"] },
      ],
      paramsets: new Map([["FIXTURE:1", paramsets]]),
    });
    const unsupported = noMaster.get("FIXTURE");
    expect(unsupported && findHeatingChannel(unsupported)).toBeUndefined();
  });

  it("rejects offline and undiscovered target addresses before reading MASTER or writing", async () => {
    const client = {
      listDevices: vi.fn().mockResolvedValue(descriptions),
      getParamsetDescription: vi.fn().mockResolvedValue(paramsets),
      getParamset: vi.fn(),
      getValue: vi.fn(),
      setValue: vi.fn(),
      putParamset: vi.fn(),
      init: vi.fn(),
    } satisfies XmlRpcClient;
    const runtime = new OpenCcuRuntime(client, {
      centralId: "test",
      interfaceId: "VirtualDevices",
    });
    await runtime.refresh();
    await expect(runtime.readHeatingSchedule("FIXTURE")).rejects.toThrow(
      "HEATING_UNAVAILABLE",
    );
    runtime.publishConnectionState("healthy");
    await expect(runtime.saveHeatingSchedule("UNKNOWN", {})).rejects.toThrow(
      "HEATING_UNAVAILABLE",
    );
    await expect(runtime.readHeatingSchedule("FIXTURE:1")).rejects.toThrow(
      "HEATING_UNAVAILABLE",
    );
    expect(client.getParamset).not.toHaveBeenCalled();
    expect(client.putParamset).not.toHaveBeenCalled();
  });
});
