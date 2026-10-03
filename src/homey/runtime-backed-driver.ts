import Homey from "homey";

import { isRuntimeProvidingApp } from "./runtime-providing-app";
import { resolvePairingDeviceIcon } from "./device-artwork";

export abstract class RuntimeBackedDriver extends Homey.Driver {
  protected abstract readonly openCcuDriverId: string;
  protected readonly pairedDeviceClass?: string;
  protected readonly pairingDuplicateDriverIds: readonly string[] = [];

  onPairListDevices(): Promise<unknown[]> {
    const app = this.homey.app;
    if (!isRuntimeProvidingApp(app)) {
      throw new Error("OpenCCU runtime is not initialized");
    }
    const pairedIds = new Set(
      this.pairingDuplicateDriverIds.flatMap((driverId) =>
        this.homey.drivers
          .getDriver(driverId)
          .getDevices()
          .flatMap((device) => {
            const data: unknown = device.getData();
            return typeof data === "object" &&
              data !== null &&
              "id" in data &&
              typeof data.id === "string"
              ? [data.id]
              : [];
          }),
      ),
    );
    return Promise.resolve(
      app.runtimeProvider
        .pairingCandidates(this.openCcuDriverId)
        .filter((candidate) => !pairedIds.has(candidate.data.id))
        .map((candidate) => {
          const icon = resolvePairingDeviceIcon(
            this.openCcuDriverId,
            candidate.store.deviceType,
          );
          return {
            name: candidate.name,
            data: candidate.data,
            ...(this.pairedDeviceClass === undefined
              ? {}
              : { class: this.pairedDeviceClass }),
            ...(icon === undefined ? {} : { icon }),
            capabilities: candidate.capabilities,
            store: candidate.store,
          };
        }),
    );
  }
}
