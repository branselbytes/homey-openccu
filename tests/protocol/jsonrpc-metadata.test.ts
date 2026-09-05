import { describe, expect, it, vi } from "vitest";

import {
  loadOpenCcuMetadata,
  type JsonRpcSession,
} from "../../src/protocol/jsonrpc/metadata";

describe("loadOpenCcuMetadata", () => {
  it("normalizes live OpenCCU response shapes", async () => {
    const responses: Record<string, unknown> = {
      "Device.listAllDetail": [
        {
          address: "301",
          name: " Hall thermostat ",
          channels: [
            { address: "301:1", name: "" },
            { address: "301:4", name: "Heating" },
          ],
        },
      ],
      "Room.getAll": [{ name: "Hall", channelIds: ["10", 11, "12"] }],
      "Subsection.getAll": [{ name: "Climate", channelIds: ["12"] }],
      "Program.getAll": [{ id: "20", name: "Night mode", isActive: true }],
      "SysVar.getAll": [
        { id: "30", name: "Temperature", type: "NUMBER", value: "21.5" },
        { id: "31", name: "Alarm", type: "ALARM", value: "true" },
        { id: "32", name: "Mode", type: "LIST", value: "Away" },
      ],
    };
    const session: JsonRpcSession = {
      call: vi.fn((method: string) => Promise.resolve(responses[method])),
    };

    const result = await loadOpenCcuMetadata(session);

    expect([...result.metadata.names]).toEqual([
      ["301", "Hall thermostat"],
      ["301:4", "Heating"],
    ]);
    expect([...result.metadata.rooms]).toEqual([["Hall", ["10", "12"]]]);
    expect([...result.metadata.functions]).toEqual([["Climate", ["12"]]]);
    expect(result.metadata.programs).toEqual([
      { id: "20", name: "Night mode", active: true },
    ]);
    expect(result.metadata.systemVariables).toEqual([
      { id: "30", name: "Temperature", value: 21.5 },
      { id: "31", name: "Alarm", value: true },
      { id: "32", name: "Mode", value: "Away" },
    ]);
    expect(result.issues).toEqual([]);
  });

  it("keeps partial metadata when one method is unavailable", async () => {
    const session: JsonRpcSession = {
      call: vi.fn((method: string) =>
        method === "Subsection.getAll"
          ? Promise.reject(new Error("method unavailable"))
          : Promise.resolve([]),
      ),
    };

    const result = await loadOpenCcuMetadata(session);

    expect(result.metadata.functions.size).toBe(0);
    expect(result.issues).toEqual([
      {
        method: "Subsection.getAll",
        message: "method unavailable",
      },
    ]);
  });
});
