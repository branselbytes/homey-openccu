import type { OpenCcuRuntimeProvider } from "./runtime-provider";

export interface HubFlowActionCard {
  registerRunListener(
    listener: (args: Readonly<Record<string, unknown>>) => Promise<unknown>,
  ): unknown;
  registerArgumentAutocompleteListener(
    argument: string,
    listener: (query: string) => Promise<readonly unknown[]> | readonly unknown[],
  ): unknown;
}

export interface HubFlowManager {
  getActionCard(id: string): HubFlowActionCard;
  getConditionCard(id: string): HubFlowActionCard;
}

export function registerHubFlowCards(
  flow: HubFlowManager,
  provider: OpenCcuRuntimeProvider,
): void {
  const programCard = flow.getActionCard("execute_openccu_program");
  programCard.registerArgumentAutocompleteListener("program", (query) =>
    provider.programOptions(query),
  );
  programCard.registerRunListener((args) =>
    provider.executeProgram(args.program),
  );

  const variableCard = flow.getActionCard("set_openccu_system_variable");
  variableCard.registerArgumentAutocompleteListener("variable", (query) =>
    provider.systemVariableOptions(query),
  );
  variableCard.registerRunListener((args) => {
    if (typeof args.value !== "string") {
      throw new TypeError("OpenCCU system-variable value must be text");
    }
    return provider.setSystemVariable(args.variable, args.value);
  });

  const conditionCard = flow.getConditionCard(
    "openccu_system_variable_equals",
  );
  conditionCard.registerArgumentAutocompleteListener("variable", (query) =>
    provider.systemVariableOptions(query),
  );
  conditionCard.registerRunListener((args) => {
    if (typeof args.value !== "string") {
      throw new TypeError("OpenCCU system-variable value must be text");
    }
    return provider.systemVariableEquals(args.variable, args.value);
  });
}
