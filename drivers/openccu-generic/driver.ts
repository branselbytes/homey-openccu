import { GENERIC_DRIVER_ID } from "../../src/mapping/device-resolver";
import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class OpenCcuGenericDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = GENERIC_DRIVER_ID;
};
