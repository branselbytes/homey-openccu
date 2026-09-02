import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpPsmDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HMIP-PSM";
};
