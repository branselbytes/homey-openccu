import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpPsDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HMIP-PS";
};
