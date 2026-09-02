import { describe, expect, it } from "vitest";

import type {
  OpenCcuChannel,
  OpenCcuDataPoint,
  OpenCcuDevice,
} from "../../src/domain/model";
import { MappingDecisionLog } from "../../src/mapping/decision";
import { mapGenericDataPoint } from "../../src/mapping/generic-mapper";

function context(channelType: string, parameter: string, writable: boolean) {
  const dataPoint = {
    centralId: "ccu",
    interfaceId: "HmIP-RF",
    channelAddress: "001:1",
    parameter,
    metadata: { TYPE: "BOOL", OPERATIONS: writable ? 7 : 5, FLAGS: 1 },
    readable: true,
    writable,
    eventable: true,
  } satisfies OpenCcuDataPoint;
  const channel = {
    address: "001:1",
    type: channelType,
    index: 1,
    paramsets: ["VALUES"],
    dataPoints: new Map([[parameter, dataPoint]]),
  } satisfies OpenCcuChannel;
  const device = {
    address: "001",
    type: "unknown",
    updatable: false,
    availability: "unknown",
    channels: new Map([[channel.address, channel]]),
  } satisfies OpenCcuDevice;
  return { device, channel, dataPoint };
}

describe("generic mapper", () => {
  it("maps writable switch state but refuses ambiguous state", () => {
    expect(mapGenericDataPoint(context("SWITCH", "STATE", true))).toMatchObject(
      {
        capability: "onoff",
        writeChannelAddress: "001:1",
        writeParameter: "STATE",
      },
    );
    const decisions = new MappingDecisionLog();
    expect(
      mapGenericDataPoint(context("UNKNOWN", "STATE", true), decisions),
    ).toBeUndefined();
    expect(decisions.list()[0]).toMatchObject({ kind: "unsupported" });
  });
});
