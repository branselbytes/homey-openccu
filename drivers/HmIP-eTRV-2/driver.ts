import { RuntimeBackedDriver } from "../../src/homey/runtime-backed-driver";

export = class HmIpEtrv2Driver extends RuntimeBackedDriver {
  protected readonly openCcuDriverId = "HmIP-eTRV-2";
  protected readonly pairingDuplicateDriverIds = [
    "HMIP-eTRV",
    "HmIP-eTRV-B",
    "HmIP-eTRV-B-2",
    "HmIP-eTRV-C",
    "HmIP-eTRV-E",
    "openccu-generic",
  ];
};
