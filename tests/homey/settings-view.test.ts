import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Homey settings view", () => {
  const view = readFileSync("settings/index.html", "utf8");

  it("writes the validated OpenCCU connection-list setting", () => {
    expect(view).toContain('const SETTINGS_KEY = "openccu_connections"');
    expect(view).toContain("hmIpRfPort");
    expect(view).toContain('type="password"');
  });

  it("does not expose removed legacy transport choices", () => {
    expect(view).not.toMatch(/MQTT|CCU Jack|RedMatic/u);
  });
});
