import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class OpenCcuHeatingGroupDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "openccu-heating-group";
  protected readonly pairedDeviceClass = "thermostat";
};
