import { describe, expect, it, vi } from "vitest";

import { ConnectionSupervisor } from "../../src/protocol/connection-supervisor";

describe("ConnectionSupervisor", () => {
  it("retries with bounded exponential backoff and becomes healthy", async () => {
    const delays: number[] = [];
    let attempts = 0;
    const supervisor = new ConnectionSupervisor({
      connect: () => {
        attempts += 1;
        return attempts < 3
          ? Promise.reject(new Error("offline"))
          : Promise.resolve();
      },
      initialDelayMs: 10,
      maxDelayMs: 20,
      wait: (milliseconds) => {
        delays.push(milliseconds);
        return Promise.resolve();
      },
    });
    supervisor.start();
    await vi.waitFor(() => expect(supervisor.state).toBe("healthy"));
    expect(delays).toEqual([10, 20]);
    await supervisor.stop();
    expect(supervisor.state).toBe("stopped");
  });
});
