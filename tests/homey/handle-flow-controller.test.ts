import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { registerHandleFlowCards } from "../../src/homey/handle-flow-controller";
import { DeviceBindingController } from "../../src/homey/device-binding-controller";
import { OpenCcuRuntime } from "../../src/runtime/openccu-runtime";
import type {
  DeviceDescription,
  ParamsetDescription,
  RpcValue,
  XmlRpcClient,
} from "../../src/protocol/xmlrpc/types";

const states = ["closed", "tilted", "open"] as const;
function cards() {
  const listeners = new Map<
    string,
    (args: Record<string, unknown>) => Promise<boolean>
  >();
  registerHandleFlowCards({
    getConditionCard: (id) => ({
      registerRunListener: (listener) => listeners.set(id, listener),
    }),
  });
  return (id: string, device: unknown) =>
    Promise.resolve().then(() => {
      const listener = listeners.get(`handle_is_${id}`);
      if (!listener) throw new Error("Missing condition");
      return listener({ device });
    });
}
function device(value: unknown) {
  return {
    hasCapability: (id: string) => id === "homematic_rhs_state",
    getCapabilityValue: () => value,
  };
}

describe("rotary handle Flow conditions", () => {
  it.each(states)(
    "matches only %s, leaving inversion to Homey",
    async (expected) => {
      const run = cards();
      for (const [value, name] of states.entries()) {
        expect(await run(expected, device(String(value)))).toBe(
          name === expected,
        );
      }
    },
  );

  it.each([null, undefined, "", "3", "CLOSED", 0, 1, 2, false])(
    "rejects unknown or invalid state %s, including for inverted conditions",
    async (value) => {
      for (const state of states)
        await expect(cards()(state, device(value))).rejects.toThrow(
          "Handle state is unknown",
        );
    },
  );

  it.each([
    null,
    {},
    { hasCapability: () => false, getCapabilityValue: () => "0" },
  ])("rejects incompatible devices %s", async (value) => {
    await expect(cards()("closed", value)).rejects.toThrow(
      "does not support handle state",
    );
  });

  it("keeps legacy enum IDs and scopes localized, invertible cards to handle devices", () => {
    const capability = JSON.parse(
      readFileSync(
        ".homeycompose/capabilities/homematic_rhs_state.json",
        "utf8",
      ),
    ) as { values: { id: string; title: { en: string } }[] };
    for (const [index, state] of states.entries()) {
      expect(
        capability.values
          .find((v) => v.id === String(index))
          ?.title.en.toLowerCase(),
      ).toBe(state);
      const manifest = JSON.parse(
        readFileSync(
          `.homeycompose/flow/conditions/handle_is_${state}.json`,
          "utf8",
        ),
      ) as {
        title: { en: string; de: string };
        titleFormatted: { en: string; de: string };
        args: { filter: string }[];
      };
      expect(manifest.title.en).toContain("!{{is|is not}}");
      expect(manifest.title.de).toContain("!{{ist|ist nicht}}");
      expect(manifest.titleFormatted).toEqual(manifest.title);
      const filter = new URLSearchParams(manifest.args[0].filter);
      expect(filter.get("driver_id")?.split("|")).toEqual([
        "HmIP-SRH",
        "openccu-generic",
      ]);
      expect(filter.get("capabilities")).toBe("homematic_rhs_state");
    }
  });

  it("reads reported STATE metadata and routes synthetic callbacks through the production binding controller into conditions without writes", async () => {
    const recording = JSON.parse(
      readFileSync("tests/fixtures/srh-handle.json", "utf8"),
    ) as {
      description: DeviceDescription;
      channels: {
        description: DeviceDescription;
        parameters: ParamsetDescription;
      }[];
    };
    const client = {
      listDevices: vi
        .fn()
        .mockResolvedValue([
          recording.description,
          ...recording.channels.map((c) => c.description),
        ]),
      getParamsetDescription: vi
        .fn()
        .mockResolvedValue(recording.channels[0].parameters),
      getParamset: vi.fn().mockResolvedValue({ STATE: 0 }),
      getValue: vi.fn(),
      setValue: vi.fn(),
      putParamset: vi.fn(),
      init: vi.fn(),
    } satisfies XmlRpcClient;
    const runtime = new OpenCcuRuntime(client, {
      centralId: "fixture",
      interfaceId: "HmIP-RF",
    });
    await runtime.refresh();
    runtime.publishConnectionState("healthy");
    const candidate = runtime.pairingCandidates()[0];
    expect(candidate.driverId).toBe("HmIP-SRH");
    const values = new Map<string, RpcValue>();
    const onCapabilityWrite = vi.fn(() => () => undefined);
    const controller = new DeviceBindingController(
      runtime,
      {
        getCapabilities: () => ["homematic_rhs_state"],
        addCapability: vi.fn().mockResolvedValue(undefined),
        removeCapability: vi.fn().mockResolvedValue(undefined),
        setCapabilityValue: (id, value) => {
          values.set(id, value);
          return Promise.resolve();
        },
        triggerButtonEvent: vi.fn().mockResolvedValue(undefined),
        onCapabilityWrite,
        setAvailable: vi.fn().mockResolvedValue(undefined),
        setUnavailable: vi.fn().mockResolvedValue(undefined),
        log: vi.fn(),
        error: vi.fn(),
      },
      candidate.store.bindings,
    );
    const handle = {
      hasCapability: (id: string) => values.has(id),
      getCapabilityValue: (id: string) => values.get(id),
    };
    const run = cards();
    try {
      await controller.start();
      expect(await run("closed", handle)).toBe(true);
      for (const [value, state] of states.entries()) {
        await runtime
          .createCallbackDispatcher()
          .dispatch("event", ["HmIP-RF", "HANDLE1:1", "STATE", value]);
        expect(values.get("homematic_rhs_state")).toBe(String(value));
        for (const expected of states)
          expect(await run(expected, handle)).toBe(expected === state);
      }
      expect(client.setValue).not.toHaveBeenCalled();
      expect(client.putParamset).not.toHaveBeenCalled();
      expect(onCapabilityWrite).not.toHaveBeenCalled();
    } finally {
      controller.stop();
    }
  });
});
