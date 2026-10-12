import { describe, expect, it } from "vitest";
import { buildHmIpDeviceGraph } from "../../src/domain/model";
import { resolveDeviceMappings } from "../../src/mapping/device-resolver";
import type { ParamsetDescription } from "../../src/protocol/xmlrpc/types";
// Synthetic protocol facts from OCCU device_fci6, wrc6_230, wgt, falmot8,
// swdo_pl, wth_b and trv_cl. No recorded device identities or vendor XML.
function device(
  model: string,
  parameters: Record<number, ParamsetDescription>,
) {
  const channels = Object.keys(parameters).map(Number);
  return buildHmIpDeviceGraph({
    centralId: "fixture",
    interfaceId: "HmIP-RF",
    descriptions: [
      {
        ADDRESS: "DESCRIPTOR",
        TYPE: model,
        CHILDREN: channels.map((i) => `DESCRIPTOR:${i}`),
      },
      ...channels.map((i) => ({
        ADDRESS: `DESCRIPTOR:${i}`,
        PARENT: "DESCRIPTOR",
        TYPE: "CHANNEL",
        PARAMSETS: ["VALUES"],
        INDEX: i,
      })),
    ],
    paramsets: new Map(channels.map((i) => [`DESCRIPTOR:${i}`, parameters[i]])),
  }).get("DESCRIPTOR")!;
}
const read = { TYPE: "FLOAT" as const, OPERATIONS: 5, FLAGS: 1 };
const write = { TYPE: "FLOAT" as const, OPERATIONS: 7, FLAGS: 1 };
describe("additional manufacturer channel layouts", () => {
  it("limits FALMOT-C8 to eight read-only valves", () => {
    const graph = device(
      "HmIP-FALMOT-C8",
      Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i + 1, { LEVEL: write }]),
      ),
    );
    const mappings = resolveDeviceMappings(graph);
    expect(mappings).toHaveLength(8);
    expect(mappings.every((m) => m.bindings.every((b) => !b.writable))).toBe(
      true,
    );
  });
  it("uses WGT climate channel 8, relay 3/4 and backlight 2", () => {
    const mappings = resolveDeviceMappings(
      device("HmIP-WGT", {
        2: { LEVEL: write },
        3: { STATE: { ...read, TYPE: "BOOL" } },
        4: { STATE: { ...write, TYPE: "BOOL" } },
        8: {
          ACTUAL_TEMPERATURE: read,
          HUMIDITY: read,
          SET_POINT_TEMPERATURE: write,
        },
      }),
    );
    expect(mappings).toHaveLength(3);
    expect(
      mappings
        .find((m) => m.logicalId === "climate")!
        .bindings.find((b) => b.capability === "target_temperature")!
        .writeChannelAddress,
    ).toBe("DESCRIPTOR:8");
    expect(
      mappings.find((m) => m.logicalId === "output-1")!.bindings[0],
    ).toMatchObject({
      channelAddress: "DESCRIPTOR:3",
      writeChannelAddress: "DESCRIPTOR:4",
    });
  });
  it("routes WRC6-230 relay and seven LEDs without virtual duplicates", () => {
    const parameters: Record<number, ParamsetDescription> = {
      8: { STATE: { ...read, TYPE: "BOOL" } },
      9: { STATE: { ...write, TYPE: "BOOL" } },
    };
    for (let i = 1; i <= 6; i++)
      parameters[i] = {
        PRESS_SHORT: { TYPE: "ACTION", OPERATIONS: 4, FLAGS: 1 },
      };
    for (let i = 12; i <= 18; i++)
      parameters[i] = {
        LEVEL: write,
        COLOR: { TYPE: "ENUM", OPERATIONS: 7, FLAGS: 1 },
      };
    const mappings = resolveDeviceMappings(device("HmIP-WRC6-230", parameters));
    expect(mappings).toHaveLength(8);
    expect(
      mappings.find((m) => m.logicalId === "output-1")!.buttonEvents,
    ).toHaveLength(6);
    expect(
      mappings.flatMap((m) => m.bindings).find((b) => b.parameter === "STATE"),
    ).toMatchObject({
      channelAddress: "DESCRIPTOR:8",
      writeChannelAddress: "DESCRIPTOR:9",
    });
  });
  it.each(["HmIP-SWDO-PL", "HmIP-SWDO-PL-2"])(
    "maps %s contact state on channel 1",
    (model) => {
      expect(
        resolveDeviceMappings(
          device(model, {
            1: { STATE: { TYPE: "BOOL", FLAGS: 1, OPERATIONS: 5 } },
          }),
        )[0].bindings[0],
      ).toMatchObject({
        capability: "alarm_contact",
        channelAddress: "DESCRIPTOR:1",
        writable: false,
      });
    },
  );
  it.each([
    "HmIP-WT",
    "HmIP-WTH-B",
    "HmIP-WTH-B-2",
    "HmIP-WTH-B-A",
    "HmIP-WTH-3",
    "HmIP-WTH-3-A",
    "HmIP-eTRV-CL",
    "HmIP-eTRV-3",
  ])("maps %s thermostat channel 1", (model) => {
    const mappings = resolveDeviceMappings(
      device(model, {
        1: { ACTUAL_TEMPERATURE: read, SET_POINT_TEMPERATURE: write },
      }),
    );
    expect(mappings).toHaveLength(1);
    expect(mappings[0].bindings.map((b) => b.capability)).toEqual([
      "measure_temperature",
      "target_temperature",
    ]);
  });
});

it("changes FCI6 inputs between contact and button modes without adding writes", () => {
  const parameters = Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [
      i + 1,
      {
        STATE: { TYPE: "BOOL" as const, OPERATIONS: 5, FLAGS: 1 },
        PRESS_SHORT: { TYPE: "ACTION" as const, OPERATIONS: 4, FLAGS: 1 },
        PRESS_LONG: { TYPE: "ACTION" as const, OPERATIONS: 4, FLAGS: 1 },
      },
    ]),
  );
  for (const mode of ["BINARY_BEHAVIOR", "KEY_BEHAVIOR"]) {
    const graph = {
      ...device("HmIP-FCI6", parameters),
      configuration: new Map(
        Array.from({ length: 6 }, (_, i) => [
          `DESCRIPTOR:${i + 1}`,
          { CHANNEL_OPERATION_MODE: mode },
        ]),
      ),
    };
    const mappings = resolveDeviceMappings(graph);
    expect(mappings).toHaveLength(6);
    for (const m of mappings) {
      expect(m.bindings.every((b) => !b.writable)).toBe(true);
      expect(m.buttonEvents).toHaveLength(mode === "KEY_BEHAVIOR" ? 2 : 0);
      expect(m.bindings).toHaveLength(mode === "KEY_BEHAVIOR" ? 0 : 1);
    }
  }
});
