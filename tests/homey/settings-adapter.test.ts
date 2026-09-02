import { describe, expect, it } from "vitest";

import {
  loadOpenCcuConnections,
  OPENCCU_CONNECTIONS_SETTING,
} from "../../src/homey/settings-adapter";

describe("Homey settings adapter", () => {
  it("treats an absent connection list as an unconfigured app", () => {
    expect(loadOpenCcuConnections({ get: () => undefined })).toEqual([]);
  });

  it("validates every stored connection and rejects duplicate central IDs", () => {
    const settings = {
      get: (key: string): unknown => {
        expect(key).toBe(OPENCCU_CONNECTIONS_SETTING);
        return [
          { centralId: "ccu-1", host: "openccu.local" },
          { centralId: "ccu-1", host: "192.0.2.5" },
        ];
      },
    };

    expect(() => loadOpenCcuConnections(settings)).toThrow(
      "Duplicate OpenCCU centralId",
    );
  });
});
