import { RuntimeBackedDevice } from "../../src/homey/runtime-backed-device";
import { safeErrorKind } from "../../src/diagnostics/safe-error";

export = class extends RuntimeBackedDevice {
  async onInit(): Promise<void> {
    await super.onInit();
    const capability = "onoff.perimeter";
    if (!this.hasCapability(capability)) return;
    const title = { en: "Perimeter alarm", de: "Alarm der Außenüberwachung" };
    try {
      const options = (this.getCapabilityOptions(capability) ?? {}) as Record<
        string,
        unknown
      >;
      const current = options.title as Record<string, unknown> | undefined;
      if (current?.en === title.en && current?.de === title.de) return;
      await this.setCapabilityOptions(capability, { ...options, title });
    } catch (error) {
      this.error("Failed to update siren control title", safeErrorKind(error));
    }
  }
};
