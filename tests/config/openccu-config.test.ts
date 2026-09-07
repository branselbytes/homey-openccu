import { describe, expect, it } from "vitest";

import {
  parseOpenCcuSettings,
  publicOpenCcuConfig,
} from "../../src/config/openccu-config";

describe("OpenCCU configuration", () => {
  it("normalizes a manual HmIP-RF connection without exposing credentials", () => {
    const config = parseOpenCcuSettings({
      centralId: " ccu-1 ",
      host: "192.0.2.10",
      hmIpRfPort: "2010",
      callbackPort: "12010",
      username: "homey",
      password: "secret",
    });

    expect(config).toMatchObject({
      centralId: "ccu-1",
      host: "192.0.2.10",
      hmIpRfPort: 2010,
      virtualDevicesPort: 9292,
      callbackPort: 12010,
      virtualDevicesCallbackPort: 12011,
      jsonRpcUrl: "http://192.0.2.10/api/homematic.cgi",
    });
    expect(JSON.stringify(publicOpenCcuConfig(config))).not.toContain("secret");
    expect(publicOpenCcuConfig(config).authenticated).toBe(true);
  });

  it.each([
    [{ centralId: "ccu", host: "http://openccu.local" }, "protocol"],
    [{ centralId: "ccu", host: "openccu.local/path" }, "path"],
    [{ centralId: "ccu", host: "openccu.local", hmIpRfPort: 70_000 }, "port"],
    [{ centralId: "ccu", host: "openccu.local", callbackPort: 0 }, "callback"],
    [
      {
        centralId: "ccu",
        host: "openccu.local",
        callbackPort: 12010,
        virtualDevicesCallbackPort: 12010,
      },
      "different",
    ],
    [
      { centralId: "ccu", host: "openccu.local", username: "homey" },
      "together",
    ],
  ])("rejects invalid settings", (input, message) => {
    expect(() => parseOpenCcuSettings(input)).toThrow(message);
  });
});
