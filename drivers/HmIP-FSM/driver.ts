import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpFsmDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HmIP-FSM";
};
