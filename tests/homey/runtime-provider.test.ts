import { describe, expect, it, vi } from "vitest";

import type { PairingCandidate } from "../../src/pairing/candidates";
import { OpenCcuRuntimeProvider } from "../../src/homey/runtime-provider";
import type { ManagedCentralRuntime } from "../../src/runtime/managed-central-runtime";

function managedRuntime(
  core: object,
  interfaces: readonly (readonly [string, object])[] = [["HmIP-RF", core]],
): ManagedCentralRuntime {
  return {
    core,
    getCore: (interfaceId: string) =>
      interfaces.find(([candidate]) => candidate === interfaceId)?.[1],
    interfaceCores: () => interfaces,
  } as unknown as ManagedCentralRuntime;
}

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
      metadata: { names: new Map() },
      pairingCandidates: vi
        .fn()
        .mockReturnValue([
          candidate("openccu-generic", "generic"),
          candidate("HMIP-PS", "switch"),
        ]),
    };
    const managed = managedRuntime(core);
    const provider = new OpenCcuRuntimeProvider({
      getRuntime: (centralId) => (centralId === "ccu-1" ? managed : undefined),
      runtimeEntries: () => [["ccu-1", managed]],
    });

    expect(provider.get("ccu-1")).toBe(core);
    expect(provider.pairingCandidates("openccu-generic")).toMatchObject([
      { name: "generic", driverId: "openccu-generic" },
    ]);
    expect(provider.systemPairingCandidates()).toEqual([
      {
        name: "OpenCCU (ccu-1)",
        data: { id: "openccu-system:ccu-1", centralId: "ccu-1" },
      },
    ]);
  });

  it("routes pairing and runtime lookup across configured interfaces", () => {
    const primary = {
      metadata: { names: new Map([["group", "Ground floor"]]) },
      pairingCandidates: vi.fn().mockReturnValue([]),
    };
    const virtual = {
      pairingCandidates: vi
        .fn()
        .mockReturnValue([candidate("openccu-heating-group", "group")]),
    };
    const managed = managedRuntime(primary, [
      ["HmIP-RF", primary],
      ["VirtualDevices", virtual],
    ]);
    const provider = new OpenCcuRuntimeProvider({
      getRuntime: () => managed,
      runtimeEntries: () => [["ccu-1", managed]],
    });

    expect(provider.get("ccu-1", "VirtualDevices")).toBe(virtual);
    expect(provider.pairingCandidates("openccu-heating-group")).toHaveLength(1);
    expect(virtual.pairingCandidates).toHaveBeenCalledWith(
      primary.metadata.names,
    );
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
    const managed = managedRuntime(core);
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

  it("loads privacy-reduced service-message views and caches rapid refreshes", async () => {
    const loadServiceMessages = vi.fn().mockResolvedValue([
      {
        id: "42",
        code: "UNREACH",
        type: 1,
        address: "301:0",
        occurrenceCount: 1,
      },
    ]);
    const core = {
      connectionState: "healthy",
      metadata: { names: new Map([["301:0", "Hall sensor"]]) },
      loadServiceMessages,
    };
    const managed = managedRuntime(core);
    const provider = new OpenCcuRuntimeProvider({
      getRuntime: () => managed,
      runtimeEntries: () => [["ccu-1", managed]],
    });

    const first = await provider.serviceMessageOverview();
    const second = await provider.serviceMessageOverview();

    expect(first.centrals).toEqual([
      {
        centralId: "ccu-1",
        connectionState: "healthy",
        messages: [
          {
            id: "42",
            code: "UNREACH",
            type: 1,
            deviceName: "Hall sensor",
            occurrenceCount: 1,
          },
        ],
      },
    ]);
    expect(second).toBe(first);
    expect(loadServiceMessages).toHaveBeenCalledOnce();
    expect(JSON.stringify(first)).not.toContain("301:0");
  });

  it("isolates service-message failures per central", async () => {
    const core = {
      connectionState: "degraded",
      loadServiceMessages: vi
        .fn()
        .mockRejectedValue(new Error("secret detail")),
    };
    const managed = managedRuntime(core);
    const provider = new OpenCcuRuntimeProvider({
      getRuntime: () => managed,
      runtimeEntries: () => [["ccu-1", managed]],
    });

    await expect(provider.serviceMessageOverview()).resolves.toMatchObject({
      centrals: [
        {
          centralId: "ccu-1",
          connectionState: "degraded",
          messages: [],
          unavailable: true,
        },
      ],
    });
  });

  it("loads privacy-reduced system status and caches rapid refreshes", async () => {
    const refreshSystemInformation = vi.fn().mockResolvedValue({
      information: {
        serviceMessageCount: 2,
        dutyCycle: 18,
        carrierSense: 7,
        radioInterfaces: [
          {
            address: "privacy-sensitive-address",
            name: "HmIP-RF",
            type: "CCU",
            dutyCycle: 18,
            carrierSense: 7,
          },
        ],
      },
      issues: [],
    });
    const core = {
      connectionState: "healthy",
      devices: new Map([["one", {}]]),
      systemInformation: undefined,
      systemInformationIssues: [],
      refreshSystemInformation,
    };
    const managed = managedRuntime(core);
    const provider = new OpenCcuRuntimeProvider({
      getRuntime: () => managed,
      runtimeEntries: () => [["ccu-1", managed]],
    });

    const first = await provider.systemStatusOverview();
    const second = await provider.systemStatusOverview();

    expect(second).toBe(first);
    expect(first.centrals).toEqual([
      {
        centralId: "ccu-1",
        connectionState: "healthy",
        deviceCount: 1,
        serviceMessageCount: 2,
        dutyCycle: 18,
        carrierSense: 7,
        radioInterfaces: [
          {
            name: "HmIP-RF",
            type: "CCU",
            dutyCycle: 18,
            carrierSense: 7,
          },
        ],
      },
    ]);
    expect(JSON.stringify(first)).not.toContain("privacy-sensitive-address");
    expect(refreshSystemInformation).toHaveBeenCalledOnce();
  });
});
