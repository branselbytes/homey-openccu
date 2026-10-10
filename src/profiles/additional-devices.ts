import type { DeviceProfile } from "./types";

/** Independently authored profiles. Reference revisions and channel facts: docs/adr/0028-additional-devices-and-bidcos-rf.md. */
export const ADDITIONAL_PROFILES: readonly DeviceProfile[] = [
  {
    id: "hm-pb-2-fm",
    driverId: "HM-PB-2-FM",
    deviceTypes: ["HM-PB-2-FM"],
    bindings: [
      {
        capability: "alarm_battery",
        channel: 0,
        parameter: "LOWBAT",
        transform: "boolean",
        readOnly: true,
      },
    ],
    buttonChannels: [1, 2],
  },
  {
    id: "hmip-falmot-c12",
    driverId: "HmIP-FALMOT-C12",
    deviceTypes: ["HmIP-FALMOT-C12"],
    bindings: [],
    logicalDevices: Array.from({ length: 12 }, (_, index) => ({
      id: `valve-${index + 1}`,
      nameSuffix: `Valve ${index + 1}`,
      nameChannel: index + 1,
      bindings: [
        {
          capability: "homematic_measure_valve",
          channel: index + 1,
          parameter: "LEVEL",
          transform: "ratio-to-percent",
          readOnly: true,
        },
        {
          capability: "alarm_generic.dew_point",
          channel: index + 1,
          parameter: "DEW_POINT_ALARM",
          transform: "boolean",
          readOnly: true,
        },
        {
          capability: "alarm_generic.emergency",
          channel: index + 1,
          parameter: "EMERGENCY_OPERATION",
          transform: "boolean",
          readOnly: true,
        },
      ],
    })),
  },
  {
    id: "hmip-miob",
    driverId: "HmIP-MIOB",
    deviceTypes: ["HmIP-MIOB"],
    bindings: [],
    logicalDevices: [
      ...[1, 5].map((channel, index) => ({
        id: `output-${index + 1}`,
        nameSuffix: `Output ${index + 1}`,
        nameChannel: channel,
        bindings: [
          {
            capability: "onoff",
            channel,
            parameter: "STATE",
            setChannel: channel + 1,
            requiresWriteTarget: true,
            transform: "boolean" as const,
          },
        ],
      })),
      ...[9, 10].map((channel, index) => ({
        id: `input-${index + 1}`,
        nameSuffix: `Input ${index + 1}`,
        nameChannel: channel,
        bindings: [
          {
            capability: "alarm_contact",
            channel,
            parameter: "STATE",
            transform: "boolean" as const,
            readOnly: true,
          },
        ],
      })),
      {
        id: "analog-output",
        nameSuffix: "Analog output",
        nameChannel: 11,
        bindings: [
          {
            capability: "dim",
            channel: 11,
            parameter: "LEVEL",
            requiresWriteTarget: true,
          },
        ],
      },
    ],
  },
];
