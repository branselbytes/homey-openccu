import { describe, expect, it, vi } from "vitest";

import { buildHmIpDeviceGraph } from "../../src/domain/model";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";
import { resolveDeviceMapping } from "../../src/mapping/device-resolver";
import type { CapabilityBinding } from "../../src/mapping/types";
import type {
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";

const capability = "homematic_detection_active";
const models = [
  ["HmIP-SMI", 1, "MOTION", "MOTION_DETECTION_ACTIVE"],
  ["HmIP-SMI55", 3, "MOTION", "MOTION_DETECTION_ACTIVE"],
  ["HmIP-SMO-A", 1, "MOTION", "MOTION_DETECTION_ACTIVE"],
  ["HmIP-SPI", 1, "PRESENCE_DETECTION_STATE", "PRESENCE_DETECTION_ACTIVE"],
  ["HmIPW-SPI", 1, "PRESENCE_DETECTION_STATE", "PRESENCE_DETECTION_ACTIVE"],
] as const;
type Model = readonly [
  type: string,
  channel: number,
  alarm: string,
  active: string,
];

function mapping(model: Model, operations: number | null = 7) {
  const [type, channel, alarm, active] = model;
  const address = `DETECTOR:${channel}`;
  const parameters: ParamsetDescription = {
    [alarm]: { TYPE: "BOOL", OPERATIONS: 5, FLAGS: 1 },
    ILLUMINATION: { TYPE: "FLOAT", OPERATIONS: 5, FLAGS: 1 },
    ...(operations === null
      ? {}
      : {
          [active]: { TYPE: "BOOL", OPERATIONS: operations, FLAGS: 1 },
        }),
  };
  const descriptions = [
    { ADDRESS: "DETECTOR", TYPE: type, CHILDREN: [address] },
    {
      ADDRESS: address,
      PARENT: "DETECTOR",
      INDEX: channel,
      TYPE:
        alarm === "MOTION"
          ? "MOTIONDETECTOR_TRANSCEIVER"
          : "PRESENCEDETECTOR_TRANSCEIVER",
      PARAMSETS: ["VALUES"],
    },
  ];
  // The SMI55's button channels must never become detection write targets.
  if (type === "HmIP-SMI55") {
    descriptions.push({
      ADDRESS: "DETECTOR:1",
      PARENT: "DETECTOR",
      INDEX: 1,
      TYPE: "KEY_TRANSCEIVER",
      PARAMSETS: ["VALUES"],
    });
    descriptions[0].CHILDREN?.push("DETECTOR:1");
  }
  const device = buildHmIpDeviceGraph({
    centralId: "fixture",
    interfaceId: "HmIP-RF",
    descriptions,
    paramsets: new Map([
      [address, parameters],
      [
        "DETECTOR:1",
        channel === 1
          ? parameters
          : { PRESS_SHORT: { TYPE: "ACTION", OPERATIONS: 4, FLAGS: 1 } },
      ],
    ]),
  }).get("DETECTOR")!;
  return resolveDeviceMapping(device);
}

function fixture(model: Model) {
  const getParamset = vi.fn().mockResolvedValue({
    [model[2]]: true,
    [model[3]]: true,
    ILLUMINATION: 123,
  });
  const setValue = vi.fn().mockResolvedValue(undefined);
  const client: XmlRpcClient = {
    listDevices: vi.fn(),
    getParamsetDescription: vi.fn(),
    init: vi.fn(),
    getParamset,
    getValue: vi.fn().mockResolvedValue(true),
    setValue,
    putParamset: vi.fn(),
  };
  const runtime = new OpenCcuRuntime(client, {
    centralId: "fixture",
    interfaceId: "HmIP-RF",
  });
  const values = new Map<string, RpcValue>();
  const listeners = new Map<string, (value: RpcValue) => Promise<void>>();
  const capabilities = new Set(["alarm_motion", "measure_luminance"]);
  const device = {
    getCapabilities: () => [...capabilities],
    addCapability: vi.fn((name: string) => {
      capabilities.add(name);
      return Promise.resolve();
    }),
    removeCapability: vi.fn((name: string) => {
      capabilities.delete(name);
      return Promise.resolve();
    }),
    setCapabilityValue: vi.fn((name: string, value: RpcValue) => {
      values.set(name, value);
      return Promise.resolve();
    }),
    onCapabilityWrite: vi.fn(
      (name: string, listener: (value: RpcValue) => Promise<void>) => {
        listeners.set(name, listener);
        return () => {
          listeners.delete(name);
        };
      },
    ),
    triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
    setAvailable: vi.fn().mockResolvedValue(undefined),
    setUnavailable: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
  };
  return { runtime, device, setValue, values, listeners };
}

describe("motion and presence detection control", () => {
  it.each(models)(
    "writes both detection states on the correct %s channel",
    async (...model) => {
      const resolved = mapping(model);
      const active = resolved.bindings.find(
        (binding) => binding.capability === capability,
      )!;
      expect(active).toMatchObject({
        channelAddress: `DETECTOR:${model[1]}`,
        parameter: model[3],
        writeChannelAddress: `DETECTOR:${model[1]}`,
        writeParameter: model[3],
        readable: true,
        writable: true,
      });
      expect(resolved.bindings.filter((binding) => binding.writable)).toEqual([
        active,
      ]);
      const { runtime, setValue } = fixture(model);
      for (const value of [false, true]) {
        await runtime.write(active, value);
        expect(setValue).toHaveBeenLastCalledWith(
          `DETECTOR:${model[1]}`,
          model[3],
          value,
          undefined,
        );
      }
      if (model[0] === "HmIP-SMI55") {
        expect(resolved.buttonEvents).toMatchObject([
          { channelAddress: "DETECTOR:1", parameter: "PRESS_SHORT" },
        ]);
      }
    },
  );

  it.each(models)(
    "omits the %s switch when the CCU does not allow writing it",
    (...model) => {
      for (const operations of [null, 0, 5]) {
        expect(
          mapping(model, operations).bindings.some(
            (binding) => binding.capability === capability,
          ),
        ).toBe(false);
      }
      // Remove the optional datapoint entirely, as on unsupported firmware.
      const withoutControl = mapping(model, null).bindings;
      expect(withoutControl.map((binding) => binding.capability)).toEqual([
        "alarm_motion",
        "measure_luminance",
      ]);
    },
  );

  it.each([models[0], models[1], models[3], models[4]])(
    "upgrades paired %s sensors and keeps detection enable separate from the alarm",
    async (...model) => {
      const { runtime, device, setValue, values, listeners } = fixture(model);
      const bindings = mapping(model).bindings;
      const stored = bindings.filter(
        (binding) => binding.capability !== capability,
      );
      const persistBindings = vi
        .fn<(bindings: readonly CapabilityBinding[]) => Promise<void>>()
        .mockResolvedValue(undefined);
      runtime.publishConnectionState("healthy");
      const controller = new DeviceBindingController(runtime, device, stored, {
        resolveBindings: () => bindings,
        persistBindings,
      });
      try {
        await controller.start();
        expect(device.addCapability).toHaveBeenCalledWith(capability);
        expect(persistBindings).toHaveBeenCalledWith(bindings);
        expect(values.get(capability)).toBe(true);
        expect(values.get("alarm_motion")).toBe(true);
        expect(setValue).not.toHaveBeenCalled();
        expect(listeners.has("alarm_motion")).toBe(false);
        await listeners.get(capability)!(false);
        expect(setValue).toHaveBeenCalledWith(
          `DETECTOR:${model[1]}`,
          model[3],
          false,
          undefined,
        );
        await runtime
          .createCallbackDispatcher()
          .dispatch("event", [
            "HmIP-RF",
            `DETECTOR:${model[1]}`,
            model[3],
            false,
          ]);
        expect(values.get(capability)).toBe(false);
        expect(values.get("alarm_motion")).toBe(true);
        await runtime
          .createCallbackDispatcher()
          .dispatch("event", [
            "HmIP-RF",
            `DETECTOR:${model[1]}`,
            model[3],
            true,
          ]);
        expect(values.get(capability)).toBe(true);
        expect(setValue).toHaveBeenCalledTimes(1);
      } finally {
        controller.stop();
      }
    },
  );

  it("reports a rejected CCU write without faking a changed detection or motion state", async () => {
    const model = models[0];
    const { runtime, device, setValue, values, listeners } = fixture(model);
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(
      runtime,
      device,
      mapping(model).bindings,
    );
    try {
      await controller.start();
      setValue.mockRejectedValueOnce(new Error("CCU rejected write"));
      await expect(listeners.get(capability)!(false)).rejects.toThrow(
        "CCU rejected write",
      );
      expect(values.get(capability)).toBe(true);
      expect(values.get("alarm_motion")).toBe(true);
    } finally {
      controller.stop();
    }
  });
});
