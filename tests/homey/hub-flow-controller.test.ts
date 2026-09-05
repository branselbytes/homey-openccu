import { describe, expect, it, vi } from "vitest";

import { registerHubFlowCards } from "../../src/homey/hub-flow-controller";

describe("OpenCCU hub Flow cards", () => {
  it("registers autocomplete and routes actions to the runtime provider", async () => {
    const runListeners = new Map<
      string,
      (args: Record<string, unknown>) => Promise<unknown>
    >();
    const autocompleteListeners = new Map<
      string,
      (query: string) => Promise<readonly unknown[]> | readonly unknown[]
    >();
    const flow = {
      getActionCard: (id: string) => ({
        registerRunListener: (
          listener: (args: Record<string, unknown>) => Promise<unknown>,
        ) => runListeners.set(id, listener),
        registerArgumentAutocompleteListener: (
          argument: string,
          listener: (query: string) => readonly unknown[],
        ) => autocompleteListeners.set(`${id}/${argument}`, listener),
      }),
      getConditionCard: (id: string) => ({
        registerRunListener: (
          listener: (args: Record<string, unknown>) => Promise<unknown>,
        ) => runListeners.set(id, listener),
        registerArgumentAutocompleteListener: (
          argument: string,
          listener: (query: string) => readonly unknown[],
        ) => autocompleteListeners.set(`${id}/${argument}`, listener),
      }),
    };
    const provider = {
      programOptions: vi.fn().mockReturnValue([{ id: "p", name: "Night" }]),
      systemVariableOptions: vi
        .fn()
        .mockReturnValue([{ id: "v", name: "Away" }]),
      executeProgram: vi.fn().mockResolvedValue(undefined),
      setSystemVariable: vi.fn().mockResolvedValue(undefined),
      systemVariableEquals: vi.fn().mockResolvedValue(true),
    };

    registerHubFlowCards(flow, provider as never);

    expect(
      await autocompleteListeners.get("execute_openccu_program/program")?.(
        "ni",
      ),
    ).toEqual([{ id: "p", name: "Night" }]);
    expect(
      await autocompleteListeners.get("set_openccu_system_variable/variable")?.(
        "aw",
      ),
    ).toEqual([{ id: "v", name: "Away" }]);

    const program = { id: "p", name: "Night" };
    const variable = { id: "v", name: "Away" };
    await runListeners.get("execute_openccu_program")?.({ program });
    await runListeners.get("set_openccu_system_variable")?.({
      variable,
      value: "true",
    });
    await runListeners.get("openccu_system_variable_equals")?.({
      variable,
      value: "true",
    });
    expect(provider.executeProgram).toHaveBeenCalledWith(program);
    expect(provider.setSystemVariable).toHaveBeenCalledWith(variable, "true");
    expect(provider.systemVariableEquals).toHaveBeenCalledWith(
      variable,
      "true",
    );
  });
});
