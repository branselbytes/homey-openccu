import Homey from "homey";

import { GENERIC_DRIVER_ID } from "../../src/mapping/device-resolver";
import { isRuntimeProvidingApp } from "../../src/homey/runtime-providing-app";

export = class OpenCcuGenericDriver extends Homey.Driver {
  onPairListDevices(): Promise<unknown[]> {
    const app = this.homey.app;
    if (!isRuntimeProvidingApp(app))
      throw new Error("OpenCCU runtime is not initialized");
    return Promise.resolve(
      app.runtimeProvider
        .pairingCandidates(GENERIC_DRIVER_ID)
        .map((candidate) => ({
          name: candidate.name,
          data: candidate.data,
          capabilities: candidate.capabilities,
          store: candidate.store,
        })),
    );
  }
};
