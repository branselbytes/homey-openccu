import type { OpenCcuRuntimeProvider } from "./runtime-provider";

export interface RuntimeProvidingApp {
  readonly runtimeProvider: OpenCcuRuntimeProvider;
}

export function isRuntimeProvidingApp(value: unknown): value is RuntimeProvidingApp {
  return (
    typeof value === "object" &&
    value !== null &&
    "runtimeProvider" in value &&
    typeof value.runtimeProvider === "object" &&
    value.runtimeProvider !== null
  );
}
