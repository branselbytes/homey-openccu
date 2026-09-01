import { describe, expect, it, vi } from "vitest";

import { detectHmIpRfBackend } from "../../src/protocol/backend-detection";
import type { XmlRpcClient } from "../../src/protocol/xmlrpc/types";

describe("detectHmIpRfBackend", () => {
  it("accepts a reachable manually configured HmIP-RF endpoint", async () => {
    const client = {
      listDevices: vi
        .fn()
        .mockResolvedValue([{ ADDRESS: "001", TYPE: "HmIP-PS" }]),
    } as unknown as XmlRpcClient;
    await expect(detectHmIpRfBackend(client)).resolves.toMatchObject({
      interfaceType: "HmIP-RF",
      devices: [{ ADDRESS: "001" }],
    });
  });

  it("classifies an unreachable endpoint", async () => {
    const client = {
      listDevices: vi.fn().mockRejectedValue(new Error("offline")),
    } as unknown as XmlRpcClient;
    await expect(detectHmIpRfBackend(client)).rejects.toMatchObject({
      code: "not-connected",
    });
  });
});
