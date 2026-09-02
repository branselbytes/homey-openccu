import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpSwdoDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HMIP-SWDO";
};
