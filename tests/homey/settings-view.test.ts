import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Homey settings view", () => {
  const view = readFileSync("settings/index.html", "utf8");

  it("writes the validated OpenCCU connection-list setting", () => {
    expect(view).toContain('const SETTINGS_KEY = "openccu_connections"');
    expect(view).toContain("hmIpRfPort");
    expect(view).toContain("virtualDevicesPort");
    expect(view).toContain("callbackPort");
    expect(view).toContain("virtualDevicesCallbackPort");
    expect(view).toContain('type="password"');
  });

  it("uses translated validation messages and ships German settings text", () => {
    expect(view).toContain(
      'Homey.__("settings.validation.central_id_required")',
    );
    expect(view).not.toContain("Central ID is required");
    const german = readFileSync("locales/de.json", "utf8");
    expect(JSON.parse(german)).toHaveProperty(
      "settings.validation.callback_ports_distinct",
    );
  });

  it("does not expose removed legacy transport choices", () => {
    expect(view).not.toMatch(/MQTT|CCU Jack|RedMatic/u);
  });

  it("offers optional UDP discovery without automatically saving a result", () => {
    expect(view).toContain('Homey.api("GET", "/discovery"');
    expect(view).toContain('id="discovered-ccu"');
    expect(view).toContain("fields.host.value = result.address");
    expect(view).not.toMatch(/showDiscoveryResults[\s\S]*Homey\.set/u);
  });

  it("exports diagnostics through share, download and copy fallbacks", () => {
    expect(view).toContain('id="diagnostics-content"');
    expect(view).toContain("navigator.share");
    expect(view).toContain("navigator.clipboard.writeText");
    expect(view).toContain('document.execCommand("copy")');
    expect(view).toContain(
      "window.setTimeout(() => URL.revokeObjectURL(url), 1000)",
    );
  });
});
