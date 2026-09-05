import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpRgbwDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HmIP-RGBW";
};
