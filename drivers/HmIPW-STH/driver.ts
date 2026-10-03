import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpWiredSthDriver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HmIPW-STH";
  protected readonly pairingDuplicateDriverIds = ["openccu-generic"];
};
