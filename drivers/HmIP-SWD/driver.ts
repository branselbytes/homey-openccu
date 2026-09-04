import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpSwdDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HmIP-SWD";
};
