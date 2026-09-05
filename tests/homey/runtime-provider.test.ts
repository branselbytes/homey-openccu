import { describe, expect, it, vi } from "vitest";

import type { PairingCandidate } from "../../src/pairing/candidates";
import { OpenCcuRuntimeProvider } from "../../src/homey/runtime-provider";
import type { ManagedCentralRuntime } from "../../src/runtime/managed-central-runtime";

function candidate(driverId: string, id: string): PairingCandidate {
  return {
    driverId,
    name: id,
    data: { id, centralId: "ccu-1", interfaceId: "HmIP-RF", address: id },
    capabilities: [],
    store: { deviceType: "test", generic: true, bindings: [] },
    mapping: {
      driverId,
      generic: true,
      bindings: [],
      buttonEvents: [],
      decisions: [],
    },
  };
}

describe("OpenCcuRuntimeProvider", () => {
  it("filters pairing candidates by Homey driver and exposes cores by central ID", () => {
    const core = {
      pairingCandidates: vi
        .fn()
        .mockReturnValue([
          candidate("openccu-generic", "generic"),
          candidate("HMIP-PS", "switch"),
        ]),
    };
    const managed = { core } as unknown as ManagedCentralRuntime;
    const provider = new OpenCcuRuntimeProvider({
      getRuntime: (centralId) => (centralId === "ccu-1" ? managed : undefined),
      runtimeEntries: () => [["ccu-1", managed]],
    });

    expect(provider.get("ccu-1")).toBe(core);
    expect(provider.pairingCandidates("openccu-generic")).toMatchObject([
      { name: "generic", driverId: "openccu-generic" },
    ]);
  });

  it("builds searchable hub options and routes encoded selections", async () => {
    const core = {
      metadata: {
        programs: [{ id: "20", name: "Night mode", active: true }],
        systemVariables: [
          { id: "30", name: "Away", type: "LOGIC", value: false },
        ],
      },
      executeProgram: vi.fn().mockResolvedValue(undefined),
      setSystemVariable: vi.fn().mockResolvedValue(undefined),
      systemVariableEquals: vi.fn().mockResolvedValue(true),
    };
    const managed = { core } as unknown as ManagedCentralRuntime;
    const provider = new OpenCcuRuntimeProvider({
      getRuntime: () => managed,
      runtimeEntries: () => [["ccu-1", managed]],
    });

    const [program] = provider.programOptions("night");
    const [variable] = provider.systemVariableOptions("away");
    expect(program).toMatchObject({ name: "Night mode", description: "ccu-1" });
    expect(variable).toMatchObject({
      name: "Away",
      description: "LOGIC · ccu-1",
    });

    await provider.executeProgram(program);
    await provider.setSystemVariable(variable, "true");
    await expect(provider.systemVariableEquals(variable, "true")).resolves.toBe(
      true,
    );
    expect(core.executeProgram).toHaveBeenCalledWith("20");
    expect(core.setSystemVariable).toHaveBeenCalledWith("30", "true");
    expect(core.systemVariableEquals).toHaveBeenCalledWith("30", "true");
  });
});
