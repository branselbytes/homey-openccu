import { describe, expect, it } from "vitest";

import constants from "../lib/constants";

describe("project tooling", () => {
  it("runs TypeScript tests", () => {
    expect("OpenCCU for Homey").toContain("OpenCCU");
  });

  it("preserves the legacy constants during TypeScript migration", () => {
    expect(constants).toEqual({
      TRANSPORT_MQTT: "mqtt",
      TRANSPORT_RPC: "rpc",
      SETTINGS_PREFIX_BRIDGE: "bridge_",
    });
  });
});
