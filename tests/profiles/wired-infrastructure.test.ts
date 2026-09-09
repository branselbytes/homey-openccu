import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildHmIpDeviceGraph } from "../../src/domain/model";
import type {
  DeviceDescription,
  ParamsetDescription,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";
import { resolveDeviceMapping } from "../../src/mapping/device-resolver";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";

interface Recording {
  description: DeviceDescription;
  channels: {
    description: DeviceDescription;
    parameters: ParamsetDescription;
  }[];
}
const recordings = JSON.parse(
  readFileSync("tests/fixtures/wired-infrastructure.json", "utf8"),
) as Recording[];
function device(type: string) {
  const r = recordings.find((r) => r.description.TYPE === type)!;
  return buildHmIpDeviceGraph({
    centralId: "fixture",
    interfaceId: "HmIP-RF",
    descriptions: [r.description, ...r.channels.map((c) => c.description)],
    paramsets: new Map(
      r.channels.map((c) => [c.description.ADDRESS, c.parameters]),
    ),
  }).get(r.description.ADDRESS)!;
}
function runtimeFixture() {
  const getValue = vi.fn().mockResolvedValue(250);
  const client: XmlRpcClient = {
    listDevices: vi.fn(),
    getParamsetDescription: vi.fn(),
    getParamset: vi.fn().mockResolvedValue({ CURRENT: 250 }),
    getValue,
    setValue: vi.fn(),
    putParamset: vi.fn(),
    init: vi.fn(),
  };
  const runtime = new OpenCcuRuntime(client, {
    centralId: "fixture",
    interfaceId: "HmIP-RF",
  });
  const port = {
    getCapabilities: () => [],
    addCapability: vi.fn(),
    removeCapability: vi.fn(),
    setCapabilityValue: vi.fn().mockResolvedValue(undefined),
    triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
    onCapabilityWrite: vi.fn(() => vi.fn()),
    setAvailable: vi.fn(),
    setUnavailable: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  };
  return { runtime, port, getValue };
}

describe("recorded DRAP, Wired presence and BRC2 profiles", () => {
  it("exposes distinct bus measurements and fault indicators without write controls", async () => {
    const d = device("HmIPW-DRAP");
    const mapping = resolveDeviceMapping(d);
    expect(mapping.driverId).toBe("HmIPW-DRAP");
    expect(mapping.bindings).toHaveLength(14);
    expect(new Set(mapping.bindings.map((b) => b.capability)).size).toBe(14);
    expect(mapping.bindings.every((b) => b.readable && !b.writable)).toBe(true);
    const { runtime, port } = runtimeFixture();
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(
      runtime,
      port,
      mapping.bindings,
    );
    await controller.start();
    for (const bus of [1, 2]) {
      const current = mapping.bindings.find(
        (b) => b.capability === `measure_current.bus_${bus}`,
      )!;
      expect(current.channelAddress).toBe(`${d.address}:${bus}`);
      await expect(runtime.read(current)).resolves.toBe(0.25);
      await runtime
        .createCallbackDispatcher()
        .dispatch("event", ["HmIP-RF", `${d.address}:${bus}`, "CURRENT", 500]);
      expect(port.setCapabilityValue).toHaveBeenLastCalledWith(
        `measure_current.bus_${bus}`,
        0.5,
      );
    }
    for (const binding of mapping.bindings.filter((b) =>
      b.capability.startsWith("alarm_generic."),
    )) {
      await runtime
        .createCallbackDispatcher()
        .dispatch("event", [
          "HmIP-RF",
          binding.channelAddress,
          binding.parameter,
          true,
        ]);
      expect(port.setCapabilityValue).toHaveBeenLastCalledWith(
        binding.capability,
        true,
      );
    }
    expect(port.onCapabilityWrite).not.toHaveBeenCalled();
    controller.stop();
  });
  it("maps Wired presence, illumination and detection control without a battery or reset control", async () => {
    const d = device("HmIPW-SPI");
    const mapping = resolveDeviceMapping(d);
    expect(mapping.driverId).toBe("HmIPW-SPI");
    expect(mapping.bindings.map((b) => b.capability)).toEqual([
      "alarm_motion",
      "measure_luminance",
      "homematic_detection_active",
    ]);
    expect(mapping.bindings[1].parameter).toBe("ILLUMINATION");
    expect(mapping.bindings.filter((b) => b.writable)).toMatchObject([
      {
        capability: "homematic_detection_active",
        parameter: "PRESENCE_DETECTION_ACTIVE",
        writeChannelAddress: `${d.address}:1`,
        writeParameter: "PRESENCE_DETECTION_ACTIVE",
      },
    ]);
    const { runtime, port } = runtimeFixture();
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(
      runtime,
      port,
      mapping.bindings,
    );
    await controller.start();
    const dispatcher = runtime.createCallbackDispatcher();
    await dispatcher.dispatch("event", [
      "HmIP-RF",
      `${d.address}:1`,
      "PRESENCE_DETECTION_STATE",
      true,
    ]);
    expect(port.setCapabilityValue).toHaveBeenLastCalledWith(
      "alarm_motion",
      true,
    );
    await dispatcher.dispatch("event", [
      "HmIP-RF",
      `${d.address}:1`,
      "ILLUMINATION",
      123,
    ]);
    expect(port.setCapabilityValue).toHaveBeenLastCalledWith(
      "measure_luminance",
      123,
    );
    await dispatcher.dispatch("event", [
      "HmIP-RF",
      `${d.address}:1`,
      "PRESENCE_DETECTION_ACTIVE",
      false,
    ]);
    expect(port.setCapabilityValue).toHaveBeenLastCalledWith(
      "homematic_detection_active",
      false,
    );
    controller.stop();
  });
  it("uses current illumination when the event illumination datapoint is absent", () => {
    const d = device("HmIPW-SPI");
    const channels = new Map(d.channels);
    const channel = channels.get(`${d.address}:1`)!;
    const points = new Map(channel.dataPoints);
    points.delete("ILLUMINATION");
    channels.set(channel.address, { ...channel, dataPoints: points });
    expect(resolveDeviceMapping({ ...d, channels }).bindings[1].parameter).toBe(
      "CURRENT_ILLUMINATION",
    );
  });
  it("routes both BRC2 buttons and short/long events despite having no battery datapoint", async () => {
    const d = device("HmIP-BRC2");
    const mapping = resolveDeviceMapping(d);
    expect(mapping.driverId).toBe("HmIP-BRC2");
    expect(mapping.bindings).toEqual([]);
    expect(mapping.buttonEvents).toHaveLength(4);
    const { runtime, port } = runtimeFixture();
    runtime.publishConnectionState("healthy");
    const controller = new DeviceBindingController(runtime, port, [], {
      resolveButtonEvents: () => mapping.buttonEvents,
    });
    await controller.start();
    for (const button of [1, 2])
      for (const [parameter, press] of [
        ["PRESS_SHORT", "short"],
        ["PRESS_LONG", "long"],
      ]) {
        await runtime
          .createCallbackDispatcher()
          .dispatch("event", [
            "HmIP-RF",
            `${d.address}:${button}`,
            parameter,
            true,
          ]);
        expect(port.triggerButtonEvent).toHaveBeenLastCalledWith(button, press);
      }
    expect(port.onCapabilityWrite).not.toHaveBeenCalled();
    controller.stop();
  });
});
