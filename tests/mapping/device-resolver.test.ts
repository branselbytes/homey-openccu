import { describe, expect, it } from "vitest";

import type { OpenCcuDevice } from "../../src/domain/model";
import {
  GENERIC_DRIVER_ID,
  resolveDeviceMapping,
} from "../../src/mapping/device-resolver";

function emptyDevice(type: string): OpenCcuDevice {
  return {
    address: "001",
    type,
    updatable: false,
    availability: "unknown",
    channels: new Map(),
  };
}

describe("device mapping resolver", () => {
  it("selects a dedicated driver for known products", () => {
    expect(resolveDeviceMapping(emptyDevice("HMIP-PS"))).toMatchObject({
      driverId: "HMIP-PS",
      profileId: "hmip-switch",
      generic: false,
    });
  });

  it("selects the generic fallback for unknown products", () => {
    expect(resolveDeviceMapping(emptyDevice("HmIP-FUTURE"))).toMatchObject({
      driverId: GENERIC_DRIVER_ID,
      generic: true,
    });
  });
});
