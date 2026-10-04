import type { HeatingController } from "./src/homey/heating-controller";
import { HeatingError } from "./src/heating/types";

interface DiagnosticsApiContext {
  readonly homey: {
    readonly app: {
      generateSupportReport(): unknown;
      discoverOpenCcus(): Promise<unknown>;
      readonly heatingController: HeatingController;
    };
  };
}

export = {
  getDiagnostics({ homey }: DiagnosticsApiContext): unknown {
    return homey.app.generateSupportReport();
  },
  getMemoryDiagnostics({
    homey,
  }: {
    readonly homey: { readonly app: { getMemoryDiagnostics(): unknown } };
  }): unknown {
    return homey.app.getMemoryDiagnostics();
  },
  getDiscovery({ homey }: DiagnosticsApiContext): Promise<unknown> {
    return homey.app.discoverOpenCcus();
  },
  getHeatingTargets({ homey }: DiagnosticsApiContext): unknown {
    return homey.app.heatingController.listTargets();
  },
  readHeatingSchedule({
    homey,
    body,
  }: DiagnosticsApiContext & { readonly body: unknown }): Promise<unknown> {
    const request = requireHeatingRequest(body, ["targetId"]);
    return homey.app.heatingController.read(request.targetId);
  },
  saveHeatingSchedule({
    homey,
    body,
  }: DiagnosticsApiContext & { readonly body: unknown }): Promise<unknown> {
    const request = requireHeatingRequest(body, [
      "targetId",
      "revision",
      "profile",
      "days",
    ]);
    return homey.app.heatingController.save(request.targetId, {
      revision: request.revision,
      profile: request.profile,
      days: request.days,
    });
  },
};

function requireHeatingRequest(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  ) {
    throw new HeatingError("HEATING_INVALID");
  }
  return value as Record<string, unknown>;
}
