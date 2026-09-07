import Homey from "homey";

import { isRuntimeProvidingApp } from "./runtime-providing-app";

export abstract class RuntimeBackedDriver extends Homey.Driver {
  protected abstract readonly openCcuDriverId: string;
  protected readonly pairedDeviceClass?: string;

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
          ...(this.pairedDeviceClass === undefined
            ? {}
            : { class: this.pairedDeviceClass }),
          capabilities: candidate.capabilities,
          store: candidate.store,
        })),
    );
  }
}
