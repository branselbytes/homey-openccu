import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import {
  discoverOpenCcus,
  OPENCCU_DISCOVERY_CLIENT_PORT,
  OPENCCU_DISCOVERY_MESSAGE,
  OPENCCU_DISCOVERY_PORT,
  parseOpenCcuDiscoveryResponse,
} from "../../src/protocol/udp-discovery";

describe("OpenCCU UDP discovery", () => {
  it("parses the type and serial while taking the address from the UDP envelope", () => {
    const response = Buffer.concat([
      Buffer.from([0x02, 0x8f, 0x91, 0xc0, 0x01]),
      Buffer.from("eQ3-HmIP-CCU3-App\0TEST0000001\0redacted", "ascii"),
    ]);

    expect(parseOpenCcuDiscoveryResponse(response, "192.0.2.5")).toEqual({
      address: "192.0.2.5",
      type: "eQ3-HmIP-CCU3-App",
      serial: "TEST0000001",
    });
  });

  it.each([
    Buffer.alloc(5),
    Buffer.from([0, 0, 0, 0, 0, 0]),
    Buffer.concat([
      OPENCCU_DISCOVERY_MESSAGE.subarray(0, 5),
      Buffer.from("OpenCCU\0\0"),
    ]),
    Buffer.concat([
      OPENCCU_DISCOVERY_MESSAGE.subarray(0, 5),
      Buffer.from("OpenCCU\0ABC\n123\0"),
    ]),
  ])("rejects malformed packets", (response) => {
    expect(
      parseOpenCcuDiscoveryResponse(response, "192.0.2.5"),
    ).toBeUndefined();
  });

  it("broadcasts the inherited discovery request and deduplicates replies", async () => {
    const socket = new FakeSocket();
    const pending = discoverOpenCcus({
      timeoutMs: 100,
      createSocket: () => socket as never,
    });
    socket.emit("listening");
    const response = Buffer.concat([
      OPENCCU_DISCOVERY_MESSAGE.subarray(0, 5),
      Buffer.from("OpenCCU\0ABC123\0", "ascii"),
    ]);
    socket.emit("message", response, { address: "192.0.2.5" });
    socket.emit("message", response, { address: "192.0.2.5" });

    await expect(pending).resolves.toEqual([
      { address: "192.0.2.5", type: "OpenCCU", serial: "ABC123" },
    ]);
    expect(socket.bind).toHaveBeenCalledWith(OPENCCU_DISCOVERY_CLIENT_PORT);
    expect(socket.setBroadcast).toHaveBeenCalledWith(true);
    expect(socket.send).toHaveBeenCalledWith(
      OPENCCU_DISCOVERY_MESSAGE,
      OPENCCU_DISCOVERY_PORT,
      "255.255.255.255",
    );
    expect(socket.close).toHaveBeenCalledOnce();
  });

  it("also probes distinct configured IPv4 addresses without accepting arbitrary targets", async () => {
    const socket = new FakeSocket();
    const pending = discoverOpenCcus({
      timeoutMs: 100,
      unicastAddresses: ["192.0.2.5", "192.0.2.5"],
      createSocket: () => socket as never,
    });
    socket.emit("listening");
    await pending;

    expect(socket.send).toHaveBeenCalledTimes(2);
    expect(socket.send).toHaveBeenLastCalledWith(
      OPENCCU_DISCOVERY_MESSAGE,
      OPENCCU_DISCOVERY_PORT,
      "192.0.2.5",
    );
    await expect(
      discoverOpenCcus({ unicastAddresses: ["openccu.invalid"] }),
    ).rejects.toThrow("must be IPv4");
  });
});

class FakeSocket extends EventEmitter {
  readonly bind = vi.fn();
  readonly close = vi.fn();
  readonly setBroadcast = vi.fn();
  readonly send = vi.fn();
}
