import { describe, expect, it, vi } from "vitest";

import SwdoDriver from "../../drivers/HMIP-SWDO/driver";
import PsmDriver from "../../drivers/HMIP-PSM/driver";
import WiredClimateDriver from "../../drivers/HmIPW-STH/driver";
import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";
import type { PairingCandidate } from "../../src/pairing/candidates";

vi.mock("homey", () => ({ default: { Driver: class {} } }));

function candidate(
  address: string,
  centralId = "ccu-1",
  interfaceId = "HmIP-RF",
): PairingCandidate {
  return {
    driverId: "HMIP-SWDO",
    name: `Contact ${address}`,
    data: {
      id: `${centralId}/${interfaceId}/${address}`,
      centralId,
      interfaceId,
      address,
    },
    capabilities: ["alarm_contact", "alarm_battery"],
    store: { deviceType: "HmIP-SWDO-A", generic: false, bindings: [] },
    mapping: {
      driverId: "HMIP-SWDO",
      generic: false,
      bindings: [],
      buttonEvents: [],
      decisions: [],
    },
  };
}

function attachHomey(
  driver: RuntimeBackedDriver,
  candidates: readonly PairingCandidate[],
  pairedDevices: Readonly<Record<string, readonly unknown[]>> = {},
) {
  const pairingCandidates = vi.fn().mockReturnValue(candidates);
  const getDriver = vi.fn((driverId: string) => ({
    getDevices: () =>
      (pairedDevices[driverId] ?? []).map((data) => ({ getData: () => data })),
  }));
  driver.homey = {
    app: { runtimeProvider: { pairingCandidates } },
    drivers: { getDriver },
  } as unknown as typeof driver.homey;
  return { pairingCandidates, getDriver };
}

describe("family pairing", () => {
  it.each([
    ["HMIP-PSM", PsmDriver],
    ["HmIPW-STH", WiredClimateDriver],
  ] as const)(
    "does not duplicate generic devices when adding support in %s",
    async (driverId, Driver) => {
      const driver = new Driver();
      const existing = { ...candidate("existing"), driverId };
      const fresh = { ...candidate("fresh"), driverId };
      const { pairingCandidates } = attachHomey(driver, [existing, fresh], {
        "openccu-generic": [existing.data],
      });
      await expect(driver.onPairListDevices()).resolves.toMatchObject([
        { data: fresh.data },
      ]);
      expect(pairingCandidates).toHaveBeenCalledWith(driverId);
    },
  );
  it("omits contacts already paired through retired drivers or generic discovery", async () => {
    const driver = new SwdoDriver();
    const oldSecondGeneration = candidate("old-2");
    const oldInvisible = candidate("old-i");
    const oldGeneric = candidate("old-generic");
    const fresh = candidate("new-a");
    const { pairingCandidates } = attachHomey(
      driver,
      [oldSecondGeneration, oldInvisible, oldGeneric, fresh],
      {
        "HmIP-SWDO-2": [oldSecondGeneration.data],
        "HmIP-SWDO-I": [oldInvisible.data],
        "openccu-generic": [oldGeneric.data],
      },
    );

    await expect(driver.onPairListDevices()).resolves.toEqual([
      {
        icon: "/models/swdo-a.svg",
        name: fresh.name,
        data: fresh.data,
        capabilities: fresh.capabilities,
        store: fresh.store,
      },
    ]);
    expect(pairingCandidates).toHaveBeenCalledWith("HMIP-SWDO");
  });

  it("keeps the same address pairable on another central or interface", async () => {
    const driver = new SwdoDriver();
    const existing = candidate("shared");
    const otherCentral = candidate("shared", "ccu-2");
    const otherInterface = candidate("shared", "ccu-1", "BidCos-RF");
    attachHomey(driver, [existing, otherCentral, otherInterface], {
      "HmIP-SWDO-2": [existing.data],
    });

    await expect(driver.onPairListDevices()).resolves.toMatchObject([
      { data: otherCentral.data },
      { data: otherInterface.data },
    ]);
  });

  it("ignores unrelated legacy device data without a stable string identity", async () => {
    const driver = new SwdoDriver();
    const fresh = candidate("new-a");
    attachHomey(driver, [fresh], {
      "HmIP-SWDO-2": [null, {}, { id: 123 }, { address: "new-a" }],
    });

    await expect(driver.onPairListDevices()).resolves.toMatchObject([
      { data: fresh.data },
    ]);
  });

  it("leaves other runtime-backed driver pairing unchanged", async () => {
    class OtherDriver extends RuntimeBackedDriver {
      protected readonly openCcuDriverId = "another-driver";
    }
    const driver = new OtherDriver();
    const fresh = candidate("new-a");
    const { getDriver } = attachHomey(driver, [fresh], {
      "HmIP-SWDO-2": [fresh.data],
    });

    await expect(driver.onPairListDevices()).resolves.toEqual([
      {
        name: fresh.name,
        data: fresh.data,
        capabilities: fresh.capabilities,
        store: fresh.store,
      },
    ]);
    expect(getDriver).not.toHaveBeenCalled();
  });
});
