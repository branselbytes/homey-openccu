import { describe, expect, it, vi } from "vitest";

import { loadOpenCcuSystemInformation } from "../../src/protocol/jsonrpc/system-information";

describe("loadOpenCcuSystemInformation", () => {
  it("normalizes radio metrics and exposes the highest load", async () => {
    const call = vi.fn((method: string) => {
      if (method === "Interface.getDutyCycle") {
        return Promise.resolve([
          {
            address: "central",
            name: "OpenCCU",
            type: "CCU2",
            dutyCycle: "17",
            carrierSense: 4.5,
          },
          {
            address: "gateway",
            type: "HMIP-HAP",
            dutyCycle: 28,
            carrierSense: -1,
          },
        ]);
      }
      return Promise.resolve("3");
    });

    const result = await loadOpenCcuSystemInformation({ call }, "HmIP-RF");

    expect(result).toEqual({
      information: {
        serviceMessageCount: 3,
        dutyCycle: 28,
        carrierSense: 4.5,
        radioInterfaces: [
          {
            address: "central",
            name: "OpenCCU",
            type: "CCU2",
            dutyCycle: 17,
            carrierSense: 4.5,
          },
          {
            address: "gateway",
            type: "HMIP-HAP",
            dutyCycle: 28,
          },
        ],
      },
      issues: [],
    });
    expect(call).toHaveBeenCalledWith(
      "Interface.getServiceMessageCount",
      { interface: "HmIP-RF" },
      undefined,
    );
  });

  it("isolates unsupported optional system APIs", async () => {
    const result = await loadOpenCcuSystemInformation(
      {
        call: vi.fn().mockRejectedValue(new Error("method unavailable")),
      },
      "HmIP-RF",
    );

    expect(result.information).toEqual({ radioInterfaces: [] });
    expect(result.issues).toEqual([
      {
        method: "Interface.getDutyCycle",
        message: "method unavailable",
      },
      {
        method: "Interface.getServiceMessageCount",
        message: "method unavailable",
      },
    ]);
  });
});
