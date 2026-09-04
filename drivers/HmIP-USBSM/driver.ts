import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpUsbsmDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HmIP-USBSM";
};
