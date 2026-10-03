import { describe, expect, it, vi } from "vitest";

import ThermostatDriver from "../../drivers/HmIP-eTRV-2/driver";
import type { PairingCandidate } from "../../src/pairing/candidates";

vi.mock("homey", () => ({ default: { Driver: class {} } }));

function candidate(
  address: string,
  centralId = "ccu-1",
  interfaceId = "HmIP-RF",
): PairingCandidate {
  return {
    driverId: "HmIP-eTRV-2",
    name: `Thermostat ${address}`,
    data: {
      id: `${centralId}/${interfaceId}/${address}`,
      address,
      centralId,
      interfaceId,
    },
    capabilities: ["measure_temperature", "target_temperature"],
    store: { deviceType: "HmIP-eTRV-B-2", generic: false, bindings: [] },
    mapping: {
      driverId: "HmIP-eTRV-2",
      generic: false,
      bindings: [],
      buttonEvents: [],
      decisions: [],
    },
  };
}

function driverFixture(
  candidates: readonly PairingCandidate[],
  paired: Readonly<Record<string, readonly PairingCandidate["data"][]>>,
) {
  const driver = new ThermostatDriver();
  const pairingCandidates = vi.fn().mockReturnValue(candidates);
  driver.homey = {
    app: { runtimeProvider: { pairingCandidates } },
    drivers: {
      getDriver: (driverId: string) => ({
        getDevices: () =>
          (paired[driverId] ?? []).map((data) => ({ getData: () => data })),
      }),
    },
  } as unknown as typeof driver.homey;
  return { driver, pairingCandidates };
}

describe("eTRV family pairing", () => {
  it.each([
    "HMIP-eTRV",
    "HmIP-eTRV-B",
    "HmIP-eTRV-B-2",
    "HmIP-eTRV-C",
    "HmIP-eTRV-E",
    "openccu-generic",
  ])("omits a thermostat already paired through %s", async (oldDriver) => {
    const existing = candidate("existing");
    const fresh = candidate("new");
    const { driver, pairingCandidates } = driverFixture([existing, fresh], {
      [oldDriver]: [existing.data],
    });
    await expect(driver.onPairListDevices()).resolves.toEqual([
      {
        icon: "/models/etrv-b-2.svg",
        name: fresh.name,
        data: fresh.data,
        capabilities: fresh.capabilities,
        store: fresh.store,
      },
    ]);
    expect(pairingCandidates).toHaveBeenCalledWith("HmIP-eTRV-2");
  });

  it("compares complete stable identities across centrals and interfaces", async () => {
    const existing = candidate("shared");
    const otherCentral = candidate("shared", "ccu-2");
    const otherInterface = candidate("shared", "ccu-1", "BidCos-RF");
    const { driver } = driverFixture([existing, otherCentral, otherInterface], {
      "HmIP-eTRV-E": [existing.data],
    });
    await expect(driver.onPairListDevices()).resolves.toMatchObject([
      { data: otherCentral.data },
      { data: otherInterface.data },
    ]);
  });
});
