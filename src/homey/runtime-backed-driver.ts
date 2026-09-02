import Homey from "homey";

import { isRuntimeProvidingApp } from "./runtime-providing-app";

export abstract class RuntimeBackedDriver extends Homey.Driver {
  protected abstract readonly openCcuDriverId: string;

  onPairListDevices(): Promise<unknown[]> {
    const app = this.homey.app;
    if (!isRuntimeProvidingApp(app)) {
      throw new Error("OpenCCU runtime is not initialized");
    }
    return Promise.resolve(
      app.runtimeProvider
        .pairingCandidates(this.openCcuDriverId)
        .map((candidate) => ({
          name: candidate.name,
          data: candidate.data,
          capabilities: candidate.capabilities,
          store: candidate.store,
        })),
    );
  }
}
