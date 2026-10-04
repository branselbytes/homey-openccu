import { RuntimeBackedDevice } from "../../src/homey/runtime-backed-device";
import { safeErrorKind } from "../../src/diagnostics/safe-error";

const CONTROL_TITLES = {
  garagedoor_closed: { en: "Garage door", de: "Garagentor" },
  onoff: { en: "Light", de: "Licht" },
} as const;

export = class HmIpModHoDevice extends RuntimeBackedDevice {
  async onInit(): Promise<void> {
    await super.onInit();
    // Existing devices retain their capabilities and Flow cards. Update only
    // their labels and hide the duplicate light toggle, preserving other options.
    for (const [capability, title] of Object.entries(CONTROL_TITLES)) {
      if (!this.hasCapability(capability)) continue;
      try {
        const options = (this.getCapabilityOptions(capability) ?? {}) as Record<
          string,
          unknown
        >;
        const current = options.title as Record<string, unknown> | undefined;
        const hideToggle = capability === "onoff";
        if (
          current?.en === title.en &&
          current?.de === title.de &&
          (!hideToggle || options.uiComponent === null)
        )
          continue;
        await this.setCapabilityOptions(capability, {
          ...options,
          title,
          ...(hideToggle ? { uiComponent: null } : {}),
        });
      } catch (error) {
        this.error(
          "Failed to update garage control options",
          safeErrorKind(error),
        );
      }
    }
  }
};
