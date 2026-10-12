import { RuntimeBackedDevice } from "../../src/homey/runtime-backed-device";
const TITLES = {
  measure_temperature: { en: "Temperature 1", de: "Temperatur 1" },
  "measure_temperature.second": { en: "Temperature 2", de: "Temperatur 2" },
  "measure_temperature.difference": {
    en: "Temperature difference (CCU)",
    de: "Temperaturdifferenz (CCU)",
  },
} as const;
export = class HmIpSte2PcbDevice extends RuntimeBackedDevice {
  async onInit(): Promise<void> {
    await super.onInit();
    for (const [capability, title] of Object.entries(TITLES)) {
      if (!this.hasCapability(capability)) continue;
      await this.setCapabilityOptions(capability, {
        ...((this.getCapabilityOptions(capability) ?? {}) as Record<
          string,
          unknown
        >),
        title,
      });
    }
  }
};
