import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpSwsdDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HmIP-SWSD";
};
