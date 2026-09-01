import { describe, expect, it } from "vitest";

import { createDiagnosticSnapshot } from "../../src/diagnostics/snapshot";

describe("diagnostic snapshot", () => {
  it("redacts credentials, addresses and event values by default", () => {
    const snapshot = createDiagnosticSnapshot({
      app: { id: "app", version: "1", node: "22" },
      central: {
        host: "192.0.2.1",
        password: "secret",
        nested: { token: "abc" },
      },
      connections: [{ interfaceId: "HmIP-RF", state: "healthy" }],
      mappings: [],
      recentEvents: [{ parameter: "STATE", value: true }],
    });
    expect(snapshot.central).toEqual({
      host: "[Address Redacted]",
      password: "[Redacted]",
      nested: { token: "[Redacted]" },
    });
    expect(snapshot.recentEvents[0]).toMatchObject({
      value: "[Value Redacted]",
    });
  });
});
