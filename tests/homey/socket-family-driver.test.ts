import { describe, expect, it, vi } from "vitest";

import SocketDriver from "../../drivers/HMIP-PSM/driver";
import type { PairingCandidate } from "../../src/pairing/candidates";

vi.mock("homey", () => ({ default: { Driver: class {} } }));

function candidate(
  address: string,
  deviceType = "HmIP-PS",
  centralId = "ccu-1",
  interfaceId = "HmIP-RF",
): PairingCandidate {
  return {
    driverId: "HMIP-PSM",
    name: `Plug ${address}`,
    data: {
      id: `${centralId}/${interfaceId}/${address}`,
      address,
      centralId,
      interfaceId,
    },
    capabilities: ["onoff"],
    store: { deviceType, generic: false, bindings: [] },
    mapping: {
      driverId: "HMIP-PSM",
      generic: false,
      bindings: [],
      buttonEvents: [],
      decisions: [],
    },
  };
}

function fixture(
  candidates: readonly PairingCandidate[],
  paired: Readonly<Record<string, readonly PairingCandidate["data"][]>>,
) {
  const driver = new SocketDriver();
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

describe("socket family pairing", () => {
  it.each(["HMIP-PS", "openccu-generic"])(
    "omits sockets already paired through %s and offers all remaining socket models together",
    async (oldDriver) => {
      const existing = candidate("existing");
      const fresh = [
        candidate("ps", "HmIP-PS"),
        candidate("psm", "HmIP-PSM"),
        candidate("psm2", "HmIP-PSM-2"),
        candidate("psm2a", "HmIP-PSM-2-A"),
      ];
      const { driver, pairingCandidates } = fixture([existing, ...fresh], {
        [oldDriver]: [existing.data],
      });
      await expect(driver.onPairListDevices()).resolves.toEqual(
        fresh.map(({ name, data, capabilities, store }, index) => ({
          icon: [
            "/models/ps.svg",
            "/models/psm.svg",
            "/models/psm-2.svg",
            "/models/psm-2.svg",
          ][index],
          name,
          data,
          capabilities,
          store,
        })),
      );
      expect(pairingCandidates).toHaveBeenCalledWith("HMIP-PSM");
    },
  );

  it("keeps identically addressed sockets from another central or interface pairable", async () => {
    const existing = candidate("shared");
    const otherCentral = candidate("shared", "HmIP-PS", "ccu-2");
    const otherInterface = candidate("shared", "HmIP-PS", "ccu-1", "other");
    const { driver } = fixture([existing, otherCentral, otherInterface], {
      "HMIP-PS": [existing.data],
    });
    await expect(driver.onPairListDevices()).resolves.toMatchObject([
      { data: otherCentral.data },
      { data: otherInterface.data },
    ]);
  });
});
