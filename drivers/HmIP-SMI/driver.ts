import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpSmiDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HmIP-SMI";
};
