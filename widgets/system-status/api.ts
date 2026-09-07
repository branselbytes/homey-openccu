import type { OpenCcuRuntimeProvider } from "../../src/homey/runtime-provider";

interface WidgetApiContext {
  readonly homey: {
    readonly app: {
      readonly runtimeProvider?: OpenCcuRuntimeProvider;
    };
  };
}

export = {
  async getSystemStatus({ homey }: WidgetApiContext) {
    const provider = homey.app.runtimeProvider;
    if (provider === undefined) {
      throw new Error("OpenCCU runtime is not ready");
    }
    return provider.systemStatusOverview();
  },
};
