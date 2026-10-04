import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  HeatingController,
  type HeatingDevicePort,
} from "../../src/homey/heating-controller";
import { OpenCcuRuntimeProvider } from "../../src/homey/runtime-provider";
import { ConnectionSupervisor } from "../../src/protocol/connection-supervisor";
import type {
  ParameterDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import { ManagedCentralRuntime } from "../../src/runtime/managed-central-runtime";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import { requestOf } from "../heating/fixture";

interface RecordedModel {
  readonly model: string;
  readonly master: readonly {
    readonly channel: number;
    readonly parameters: ParamsetDescription;
  }[];
  readonly activeProfile: readonly {
    readonly channel: number;
    readonly parameter: ParameterDescription;
  }[];
}

const recording = JSON.parse(
  readFileSync("tests/fixtures/heating-master.json", "utf8"),
) as { readonly models: readonly RecordedModel[] };

function transport(interfaceId: string, model: RecordedModel) {
  const master = model.master.find(({ channel }) => channel === 1)?.parameters;
  const active = model.activeProfile.find(
    ({ channel }) => channel === 1,
  )?.parameter;
  if (!master || !active) throw new Error("Incomplete recorded metadata");
  // Both interfaces intentionally contain the same synthetic address. The
  // controller must preserve interface identity through the complete stack.
  const address = "FIXTURE";
  const channelAddress = `${address}:1`;
  const values: Record<string, RpcValue> = Object.fromEntries(
    Object.keys(master).map((key) => [
      key,
      key.includes("_ENDTIME_") ? (key.endsWith("_1") ? 360 : 1440) : 20,
    ]),
  );
  values.CHILD_LOCK = true;
  const valueDescription: ParamsetDescription = {
    ACTIVE_PROFILE: active,
    SET_POINT_TEMPERATURE: {
      TYPE: "FLOAT",
      OPERATIONS: 7,
      FLAGS: 1,
      MIN: 5,
      MAX: 30,
    },
  };
  const client = {
    listDevices: vi.fn<XmlRpcClient["listDevices"]>().mockResolvedValue([
      { ADDRESS: address, TYPE: model.model, CHILDREN: [channelAddress] },
      {
        ADDRESS: channelAddress,
        TYPE: "HEATING_CLIMATECONTROL_TRANSCEIVER",
        PARENT: address,
        INDEX: 1,
        PARAMSETS: ["VALUES", "MASTER"],
      },
    ]),
    getParamsetDescription: vi
      .fn<XmlRpcClient["getParamsetDescription"]>()
      .mockImplementation((_address, key) =>
        Promise.resolve(key === "MASTER" ? master : valueDescription),
      ),
    getParamset: vi
      .fn<XmlRpcClient["getParamset"]>()
      .mockImplementation((_address, key) =>
        Promise.resolve(
          key === "MASTER" ? { ...values } : { ACTIVE_PROFILE: 1 },
        ),
      ),
    putParamset: vi
      .fn<XmlRpcClient["putParamset"]>()
      .mockImplementation((_address, _key, changes) => {
        Object.assign(values, changes);
        return Promise.resolve();
      }),
    getValue: vi.fn<XmlRpcClient["getValue"]>(),
    setValue: vi.fn<XmlRpcClient["setValue"]>(),
    init: vi.fn<XmlRpcClient["init"]>(),
  } satisfies XmlRpcClient;
  const core = new OpenCcuRuntime(client, {
    centralId: "fixture-central",
    interfaceId,
  });
  const device: HeatingDevicePort = {
    getData: () => ({ centralId: "fixture-central", interfaceId, address }),
    getName: () => model.model,
    getStoreValue: () => model.model,
    hasCapability: (capability) => capability === "target_temperature",
  };
  return { client, core, device, values, channelAddress, interfaceId };
}

async function fixture() {
  const groupModel = recording.models.find(
    ({ model }) => model === "HmIP-HEATING",
  );
  const thermostatModel = recording.models.find(({ model }) =>
    model.startsWith("HmIP-eTRV"),
  );
  if (!groupModel || !thermostatModel)
    throw new Error("Missing recorded heating models");
  const group = transport("VirtualDevices", groupModel);
  const thermostat = transport("HmIP-RF", thermostatModel);
  const interfaces = [thermostat, group];
  for (const { core } of interfaces) {
    await core.refresh();
    core.publishConnectionState("healthy");
  }
  // Registry/lifecycle objects are real but are never started: no callback
  // sockets or network connection are needed for this transport fixture.
  const managed = new ManagedCentralRuntime(
    interfaces.map(({ interfaceId, core }) => ({
      interfaceId,
      core,
      supervisor: new ConnectionSupervisor({
        connect: () => Promise.resolve(),
      }),
      callbackServer: {
        ready: () => Promise.resolve(),
        close: () => Promise.resolve(),
      },
    })),
  );
  const provider = new OpenCcuRuntimeProvider({
    getRuntime: (centralId) =>
      centralId === "fixture-central" ? managed : undefined,
    runtimeEntries: () => [["fixture-central", managed]],
  });
  const controller = new HeatingController(
    () => interfaces.map(({ device }) => device),
    () => provider,
  );
  return { controller, group, thermostat };
}

describe("heating controller through runtime and XML-RPC fixture", () => {
  it("edits a stored group profile through VirtualDevices without touching the same address on HmIP-RF", async () => {
    const { controller, group, thermostat } = await fixture();
    const target = controller.targetForDevice(group.device);
    const schedule = await controller.read(target.id);
    expect(schedule.profiles).toHaveLength(6);
    expect(schedule.selectableProfiles).toEqual([1, 2, 3]);
    expect(target.id).not.toBe(
      controller.targetForDevice(thermostat.device).id,
    );
    const request = requestOf(schedule, 6);
    request.days.MONDAY[0].temperature = 22;
    const result = await controller.save(target.id, request);
    expect(result.status).toBe("confirmed");
    expect(result.schedule?.activeProfile).toBe(1);
    expect(group.client.putParamset).toHaveBeenCalledExactlyOnceWith(
      group.channelAddress,
      "MASTER",
      { P6_TEMPERATURE_MONDAY_1: 22 },
      undefined,
      { P6_TEMPERATURE_MONDAY_1: "FLOAT" },
    );
    expect(group.values.CHILD_LOCK).toBe(true);
    expect(group.values.P1_TEMPERATURE_MONDAY_1).toBe(20);
    expect(thermostat.client.putParamset).not.toHaveBeenCalled();
    expect(group.client.setValue).not.toHaveBeenCalled();
    await expect(controller.save(target.id, request)).rejects.toThrow(
      "HEATING_CONFLICT",
    );
    expect(group.client.putParamset).toHaveBeenCalledTimes(1);
  });

  it("keeps a write pending until XML-RPC acknowledges, then reports stale readback without retrying", async () => {
    const { controller, group, thermostat } = await fixture();
    const target = controller.targetForDevice(group.device);
    const request = requestOf(await controller.read(target.id));
    request.days.MONDAY[0].temperature = 21;
    let acknowledge: () => void = () => {
      throw new Error("The write was not submitted");
    };
    group.client.putParamset.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
    );
    let settled = false;
    const saving = controller.save(target.id, request).then((result) => {
      settled = true;
      return result;
    });
    await vi.waitFor(() =>
      expect(group.client.putParamset).toHaveBeenCalledTimes(1),
    );
    expect(settled).toBe(false);
    await expect(controller.save(target.id, request)).rejects.toThrow(
      "HEATING_BUSY",
    );
    acknowledge();
    expect((await saving).status).toBe("pending");
    expect(group.client.putParamset).toHaveBeenCalledTimes(1);
    expect(thermostat.client.putParamset).not.toHaveBeenCalled();
    expect(group.values.P1_TEMPERATURE_MONDAY_1).toBe(20);
  });
});
