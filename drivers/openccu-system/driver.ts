import Homey from "homey";

import { isRuntimeProvidingApp } from "../../src/homey/runtime-providing-app";

export = class OpenCcuSystemDriver extends Homey.Driver {
  onPairListDevices(): Promise<unknown[]> {
    const app = this.homey.app;
    if (!isRuntimeProvidingApp(app)) {
      throw new Error("OpenCCU runtime is not initialized");
    }
    return Promise.resolve([...app.runtimeProvider.systemPairingCandidates()]);
  }
};
