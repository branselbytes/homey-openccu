import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpSwdmDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HmIP-SWDM";
};
