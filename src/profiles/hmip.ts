import type { DeviceProfile, LogicalDeviceProfile } from "./types";

const SWITCH_BINDINGS: DeviceProfile["bindings"] = [
  { capability: "onoff", channel: 3, parameter: "STATE" },
];

function switchBindings(channel: number): DeviceProfile["bindings"] {
  return [{ capability: "onoff", channel, parameter: "STATE" }];
}

export const HMIP_SWITCH_PROFILE: DeviceProfile = {
  id: "hmip-switch",
  driverId: "HMIP-PS",
  deviceTypes: ["HMIP-PS", "HmIP-PS"],
  bindings: SWITCH_BINDINGS,
};

const HMIP_PCBS_PROFILE: DeviceProfile = {
  id: "hmip-pcbs",
  driverId: "HmIP-PCBS",
  deviceTypes: ["HmIP-PCBS"],
  bindings: SWITCH_BINDINGS,
};

const HMIP_PCBS_BAT_PROFILE: DeviceProfile = {
  id: "hmip-pcbs-bat",
  driverId: "HmIP-PCBS-BAT",
  deviceTypes: ["HmIP-PCBS-BAT"],
  bindings: SWITCH_BINDINGS,
};

const HMIP_DRSI1_PROFILE: DeviceProfile = {
  id: "hmip-drsi1",
  driverId: "HmIP-DRSI1",
  deviceTypes: ["HmIP-DRSI1"],
  bindings: SWITCH_BINDINGS,
};

function switchOutputs(
  channels: readonly number[],
): readonly LogicalDeviceProfile[] {
  return channels.map((channel, index) => ({
    id: `output-${index + 1}`,
    nameSuffix: `Output ${index + 1}`,
    nameChannel: channel,
    bindings: [{ capability: "onoff", channel, parameter: "STATE" }],
  }));
}

function dimmerBindings(channel: number): DeviceProfile["bindings"] {
  return [
    {
      capability: "onoff",
      channel,
      parameter: "LEVEL",
      transform: "positive-number-to-boolean",
    },
    { capability: "dim", channel, parameter: "LEVEL" },
  ];
}

function dimmerOutputs(
  channels: readonly number[],
): readonly LogicalDeviceProfile[] {
  return channels.map((channel, index) => ({
    id: `output-${index + 1}`,
    nameSuffix: `Output ${index + 1}`,
    nameChannel: channel,
    bindings: dimmerBindings(channel),
  }));
}

function daliOutputs(): readonly LogicalDeviceProfile[] {
  return Array.from({ length: 48 }, (_, index) => {
    const channel = index + 1;
    return {
      id: `output-${channel}`,
      nameSuffix: `Output ${channel}`,
      nameChannel: channel,
      bindings: [
        ...dimmerBindings(channel),
        {
          capability: "light_hue",
          channel,
          parameter: "HUE",
          transform: "hue-degrees-to-ratio" as const,
        },
        {
          capability: "light_saturation",
          channel,
          parameter: "SATURATION",
        },
      ],
    };
  });
}

const RGB_MODES = ["RGB", "RGBW"] as const;
const PWM_MODE = ["4_PWM"] as const;
const TUNABLE_WHITE_OR_PWM_MODES = ["2_TUNABLE_WHITE", "4_PWM"] as const;

function operationModeCondition(oneOf: readonly string[]) {
  return [{ channel: 0, parameter: "DEVICE_OPERATION_MODE", oneOf }] as const;
}

function rgbwOutput(
  channel: number,
  modes?: readonly string[],
): LogicalDeviceProfile {
  return {
    id: `output-${channel}`,
    nameSuffix: `Output ${channel}`,
    nameChannel: channel,
    ...(modes === undefined ? {} : { conditions: operationModeCondition(modes) }),
    bindings: [
      ...dimmerBindings(channel),
      {
        capability: "light_hue",
        channel,
        parameter: "HUE",
        transform: "hue-degrees-to-ratio",
        conditions: operationModeCondition(RGB_MODES),
      },
      {
        capability: "light_saturation",
        channel,
        parameter: "SATURATION",
        conditions: operationModeCondition(RGB_MODES),
      },
    ],
  };
}

const HMIP_DRSI4_PROFILE: DeviceProfile = {
  id: "hmip-drsi4",
  driverId: "HmIP-DRSI4",
  deviceTypes: ["HmIP-DRSI4"],
  bindings: [],
  logicalDevices: switchOutputs([6, 10, 14, 18]),
};

const HMIP_MOD_OC8_PROFILE: DeviceProfile = {
  id: "hmip-mod-oc8",
  driverId: "HmIP-MOD-OC8",
  deviceTypes: ["HmIP-MOD-OC8"],
  bindings: [],
  logicalDevices: switchOutputs([10, 14, 18, 22, 26, 30, 34, 38]),
};

const HMIP_FSI_PROFILE: DeviceProfile = {
  id: "hmip-fsi",
  driverId: "HmIP-FSI",
  deviceTypes: ["HmIP-FSI"],
  bindings: switchBindings(3),
};

const HMIP_FSI6_PROFILE: DeviceProfile = {
  id: "hmip-fsi6",
  driverId: "HmIP-FSI6",
  deviceTypes: ["HmIP-FSI6"],
  bindings: switchBindings(3),
};

const HMIP_FSI16_PROFILE: DeviceProfile = {
  id: "hmip-fsi16",
  driverId: "HmIP-FSI16",
  deviceTypes: ["HmIP-FSI16"],
  bindings: switchBindings(3),
};

const HMIP_FS6_PROFILE: DeviceProfile = {
  id: "hmip-fs6",
  driverId: "HmIP-FS6",
  deviceTypes: ["HmIP-FS6"],
  bindings: switchBindings(2),
};

const HMIP_USBSM_PROFILE: DeviceProfile = {
  id: "hmip-usbsm",
  driverId: "HmIP-USBSM",
  deviceTypes: ["HmIP-USBSM"],
  bindings: SWITCH_BINDINGS,
};

const HMIP_WGC_PROFILE: DeviceProfile = {
  id: "hmip-wgc",
  driverId: "HmIP-WGC",
  deviceTypes: ["HmIP-WGC"],
  bindings: SWITCH_BINDINGS,
};

const HMIP_PCBS2_PROFILE: DeviceProfile = {
  id: "hmip-pcbs2",
  driverId: "HmIP-PCBS2",
  deviceTypes: ["HmIP-PCBS2"],
  bindings: [],
  logicalDevices: switchOutputs([4, 8]),
};

const HMIP_BS2_PROFILE: DeviceProfile = {
  id: "hmip-bs2",
  driverId: "HmIP-BS2",
  deviceTypes: ["HmIP-BS2"],
  bindings: [],
  logicalDevices: switchOutputs([4, 8]),
};

const HMIP_WHS2_PROFILE: DeviceProfile = {
  id: "hmip-whs2",
  driverId: "HmIP-WHS2",
  deviceTypes: ["HmIP-WHS2"],
  bindings: [],
  logicalDevices: switchOutputs([2, 6]),
};

const HMIP_BDT_PROFILE: DeviceProfile = {
  id: "hmip-bdt",
  driverId: "HmIP-BDT",
  deviceTypes: ["HmIP-BDT"],
  bindings: dimmerBindings(4),
  buttonChannels: [1, 2],
};

const HMIP_FDT_PROFILE: DeviceProfile = {
  id: "hmip-fdt",
  driverId: "HmIP-FDT",
  deviceTypes: ["HmIP-FDT"],
  bindings: dimmerBindings(2),
};

const HMIP_PDT_PROFILE: DeviceProfile = {
  id: "hmip-pdt",
  driverId: "HmIP-PDT",
  deviceTypes: ["HmIP-PDT"],
  bindings: dimmerBindings(3),
};

const HMIP_DRDI3_PROFILE: DeviceProfile = {
  id: "hmip-drdi3",
  driverId: "HmIP-DRDI3",
  deviceTypes: ["HmIP-DRDI3"],
  bindings: [],
  logicalDevices: dimmerOutputs([5, 9, 13]),
};

const HMIP_DRG_DALI_PROFILE: DeviceProfile = {
  id: "hmip-drg-dali",
  driverId: "HmIP-DRG-DALI",
  deviceTypes: ["HmIP-DRG-DALI"],
  bindings: [],
  logicalDevices: daliOutputs(),
};

const HMIP_RGBW_PROFILE: DeviceProfile = {
  id: "hmip-rgbw",
  driverId: "HmIP-RGBW",
  deviceTypes: ["HmIP-RGBW"],
  bindings: [],
  configurationParameters: [
    { channel: 0, parameter: "DEVICE_OPERATION_MODE" },
  ],
  logicalDevices: [
    rgbwOutput(1),
    rgbwOutput(2, TUNABLE_WHITE_OR_PWM_MODES),
    rgbwOutput(3, PWM_MODE),
    rgbwOutput(4, PWM_MODE),
  ],
};

const HMIP_BSM_PROFILE: DeviceProfile = {
  id: "hmip-bsm",
  driverId: "HmIP-BSM",
  deviceTypes: ["HmIP-BSM"],
  bindings: [
    { capability: "onoff", channel: 4, parameter: "STATE" },
    { capability: "measure_power", channel: 7, parameter: "POWER" },
    { capability: "measure_voltage", channel: 7, parameter: "VOLTAGE" },
    {
      capability: "measure_current",
      channel: 7,
      parameter: "CURRENT",
      transform: "milliamp-to-amp",
    },
    {
      capability: "meter_power",
      channel: 7,
      parameter: "ENERGY_COUNTER",
      transform: "watt-hour-to-kilowatt-hour",
    },
  ],
  buttonChannels: [1, 2],
};

function meteredSwitchProfile(
  id: string,
  driverId: string,
  deviceType: string,
  switchChannel: number,
  meterChannel: number,
): DeviceProfile {
  return {
    id,
    driverId,
    deviceTypes: [deviceType],
    bindings: [
      { capability: "onoff", channel: switchChannel, parameter: "STATE" },
      { capability: "measure_power", channel: meterChannel, parameter: "POWER" },
      {
        capability: "measure_voltage",
        channel: meterChannel,
        parameter: "VOLTAGE",
      },
      {
        capability: "measure_current",
        channel: meterChannel,
        parameter: "CURRENT",
        transform: "milliamp-to-amp",
      },
      {
        capability: "meter_power",
        channel: meterChannel,
        parameter: "ENERGY_COUNTER",
        transform: "watt-hour-to-kilowatt-hour",
      },
    ],
  };
}

const HMIP_FSM_PROFILE = meteredSwitchProfile(
  "hmip-fsm",
  "HmIP-FSM",
  "HmIP-FSM",
  2,
  5,
);

const HMIP_FSM16_PROFILE = meteredSwitchProfile(
  "hmip-fsm16",
  "HmIP-FSM16",
  "HmIP-FSM16",
  2,
  5,
);

export const HMIP_POWER_METER_PROFILE: DeviceProfile = {
  id: "hmip-power-meter-switch",
  driverId: "HMIP-PSM",
  deviceTypes: ["HMIP-PSM", "HmIP-PSM"],
  bindings: [
    { capability: "onoff", channel: 3, parameter: "STATE" },
    { capability: "measure_power", channel: 6, parameter: "POWER" },
    { capability: "measure_voltage", channel: 6, parameter: "VOLTAGE" },
    {
      capability: "measure_current",
      channel: 6,
      parameter: "CURRENT",
      transform: "milliamp-to-amp",
    },
    {
      capability: "meter_power",
      channel: 6,
      parameter: "ENERGY_COUNTER",
      transform: "watt-hour-to-kilowatt-hour",
    },
  ],
};

const SENSOR_MAINTENANCE_BINDING = {
  capability: "alarm_battery",
  channel: 0,
  parameter: "LOW_BAT",
  transform: "boolean",
} as const;

const SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK: DeviceProfile["bindings"][number] =
  {
    ...SENSOR_MAINTENANCE_BINDING,
    fallbackParameters: ["LOWBAT"],
  };

const HMIP_WSM_PROFILE: DeviceProfile = {
  id: "hmip-wsm",
  driverId: "HmIP-WSM",
  deviceTypes: ["HmIP-WSM"],
  bindings: [
    { capability: "onoff", channel: 4, parameter: "STATE" },
    { capability: "measure_water", channel: 2, parameter: "WATER_FLOW" },
    {
      capability: "meter_water",
      channel: 2,
      parameter: "WATER_VOLUME",
      transform: "liter-to-cubic-meter",
    },
    SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK,
  ],
};

const CONTACT_BINDINGS: DeviceProfile["bindings"] = [
  {
    capability: "alarm_contact",
    channel: 1,
    parameter: "STATE",
    transform: "boolean",
  },
  {
    capability: "alarm_battery",
    channel: 0,
    parameter: "LOW_BAT",
    transform: "boolean",
  },
];

export const HMIP_CONTACT_PROFILE: DeviceProfile = {
  id: "hmip-contact",
  driverId: "HMIP-SWDO",
  deviceTypes: ["HMIP-SWDO", "HmIP-SWDO"],
  bindings: CONTACT_BINDINGS,
};

const HMIP_SWDO_I_PROFILE: DeviceProfile = {
  id: "hmip-swdo-i",
  driverId: "HmIP-SWDO-I",
  deviceTypes: ["HmIP-SWDO-I"],
  bindings: CONTACT_BINDINGS,
};

const HMIP_SWDM_PROFILE: DeviceProfile = {
  id: "hmip-swdm",
  driverId: "HmIP-SWDM",
  deviceTypes: ["HmIP-SWDM"],
  bindings: CONTACT_BINDINGS,
};

const HMIP_SRH_PROFILE: DeviceProfile = {
  id: "hmip-srh",
  driverId: "HmIP-SRH",
  deviceTypes: ["HmIP-SRH"],
  bindings: [
    {
      capability: "homematic_rhs_state",
      channel: 1,
      parameter: "STATE",
      transform: "enum-number-to-string",
    },
    SENSOR_MAINTENANCE_BINDING,
  ],
};

export const HMIP_CONTACT_2_PROFILE: DeviceProfile = {
  id: "hmip-contact-2",
  driverId: "HmIP-SWDO-2",
  deviceTypes: ["HmIP-SWDO-2"],
  bindings: [
    {
      capability: "alarm_contact",
      channel: 1,
      parameter: "STATE",
      transform: "boolean",
    },
    SENSOR_MAINTENANCE_BINDING,
  ],
};

export const HMIP_WEATHER_PROFILE: DeviceProfile = {
  id: "hmip-weather",
  driverId: "HmIP-SWO-PR",
  deviceTypes: ["HmIP-SWO-PR"],
  bindings: [
    {
      capability: "measure_temperature",
      channel: 1,
      parameter: "ACTUAL_TEMPERATURE",
    },
    { capability: "measure_humidity", channel: 1, parameter: "HUMIDITY" },
    { capability: "measure_luminance", channel: 1, parameter: "ILLUMINATION" },
    SENSOR_MAINTENANCE_BINDING,
  ],
};

export const HMIP_LIGHT_SENSOR_PROFILE: DeviceProfile = {
  id: "hmip-light-sensor",
  driverId: "HmIP-SLO",
  deviceTypes: ["HmIP-SLO"],
  bindings: [
    {
      capability: "measure_luminance",
      channel: 1,
      parameter: "CURRENT_ILLUMINATION",
    },
    SENSOR_MAINTENANCE_BINDING,
  ],
};

export const HMIP_TEMPERATURE_SENSOR_PROFILE: DeviceProfile = {
  id: "hmip-temperature-sensor",
  driverId: "HmIP-STE2-PCB",
  deviceTypes: ["HmIP-STE2-PCB"],
  bindings: [
    {
      capability: "measure_temperature",
      channel: 1,
      parameter: "ACTUAL_TEMPERATURE",
    },
    SENSOR_MAINTENANCE_BINDING,
  ],
};

const HMIP_SCTH230_PROFILE: DeviceProfile = {
  id: "hmip-scth230",
  driverId: "HmIP-SCTH230",
  deviceTypes: ["HmIP-SCTH230"],
  bindings: [
    { capability: "measure_co2", channel: 1, parameter: "CONCENTRATION" },
    {
      capability: "measure_temperature",
      channel: 4,
      parameter: "ACTUAL_TEMPERATURE",
    },
    { capability: "measure_humidity", channel: 4, parameter: "HUMIDITY" },
    { capability: "onoff", channel: 8, parameter: "STATE" },
  ],
};

const MOTION_SENSOR_BINDINGS: DeviceProfile["bindings"] = [
  {
    capability: "alarm_motion",
    channel: 1,
    parameter: "MOTION",
    transform: "boolean",
  },
  {
    capability: "measure_luminance",
    channel: 1,
    parameter: "CURRENT_ILLUMINATION",
    fallbackParameters: ["ILLUMINATION"],
  },
  SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK,
];

const HMIP_SMI_PROFILE: DeviceProfile = {
  id: "hmip-smi",
  driverId: "HmIP-SMI",
  deviceTypes: ["HmIP-SMI"],
  bindings: MOTION_SENSOR_BINDINGS,
};

const HMIP_SMI55_PROFILE: DeviceProfile = {
  id: "hmip-smi55",
  driverId: "HmIP-SMI55",
  deviceTypes: ["HmIP-SMI55"],
  bindings: MOTION_SENSOR_BINDINGS,
  buttonChannels: [1, 2],
};

const HMIP_BRC2_PROFILE: DeviceProfile = {
  id: "hmip-brc2",
  driverId: "HmIP-BRC2",
  deviceTypes: ["HmIP-BRC2"],
  bindings: [SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK],
  buttonChannels: [1, 2],
};

const HMIP_WRC2_PROFILE: DeviceProfile = {
  id: "hmip-wrc2",
  driverId: "HMIP-WRC2",
  deviceTypes: ["HMIP-WRC2", "HmIP-WRC2"],
  bindings: [SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK],
  buttonChannels: [1, 2],
};

const HMIP_WRC6_PROFILE: DeviceProfile = {
  id: "hmip-wrc6",
  driverId: "HmIP-WRC6",
  deviceTypes: ["HmIP-WRC6"],
  bindings: [SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK],
  buttonChannels: [1, 2, 3, 4, 5, 6],
};

const HMIP_RC8_PROFILE: DeviceProfile = {
  id: "hmip-rc8",
  driverId: "HmIP-RC8",
  deviceTypes: ["HmIP-RC8"],
  bindings: [SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK],
  buttonChannels: [1, 2, 3, 4, 5, 6, 7, 8],
};

const HMIP_SMO_A_PROFILE: DeviceProfile = {
  id: "hmip-smo-a",
  driverId: "HmIP-SMO-A",
  deviceTypes: ["HmIP-SMO-A"],
  bindings: MOTION_SENSOR_BINDINGS,
};

const HMIP_SPI_PROFILE: DeviceProfile = {
  id: "hmip-spi",
  driverId: "HmIP-SPI",
  deviceTypes: ["HmIP-SPI"],
  bindings: [
    {
      capability: "alarm_motion",
      channel: 1,
      parameter: "PRESENCE_DETECTION_STATE",
      transform: "boolean",
    },
    ...MOTION_SENSOR_BINDINGS.filter(
      (binding) => binding.capability !== "alarm_motion",
    ),
  ],
};

const HMIP_SAM_PROFILE: DeviceProfile = {
  id: "hmip-sam",
  driverId: "HmIP-SAM",
  deviceTypes: ["HmIP-SAM"],
  bindings: [
    {
      capability: "alarm_motion",
      channel: 1,
      parameter: "MOTION",
      transform: "boolean",
    },
    SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK,
  ],
};

const HMIP_SWD_PROFILE: DeviceProfile = {
  id: "hmip-swd",
  driverId: "HmIP-SWD",
  deviceTypes: ["HmIP-SWD"],
  bindings: [
    {
      capability: "alarm_water",
      channel: 1,
      parameter: "WATERLEVEL_DETECTED",
      fallbackParameters: ["MOISTURE_DETECTED", "ALARMSTATE", "STATE"],
      transform: "boolean",
    },
    SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK,
  ],
};

const HMIP_SWSD_PROFILE: DeviceProfile = {
  id: "hmip-swsd",
  driverId: "HmIP-SWSD",
  deviceTypes: ["HmIP-SWSD"],
  bindings: [
    {
      capability: "alarm_smoke",
      channel: 1,
      parameter: "SMOKE_DETECTOR_ALARM_STATUS",
      transform: "smoke-status-to-boolean",
    },
    {
      capability: "onoff",
      channel: 1,
      parameter: "SMOKE_DETECTOR_ALARM_STATUS",
      setParameter: "SMOKE_DETECTOR_COMMAND",
      requiresWriteTarget: true,
      transform: "smoke-status-to-boolean",
      writeStrategy: "smoke-siren",
    },
    SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK,
  ],
};

const HMIP_ASIR_PROFILE: DeviceProfile = {
  id: "hmip-asir",
  driverId: "HmIP-ASIR",
  deviceTypes: ["HmIP-ASIR"],
  bindings: [
    {
      capability: "onoff",
      channel: 3,
      parameter: "ACOUSTIC_ALARM_ACTIVE",
      setParameter: "ACOUSTIC_ALARM_SELECTION",
      requiresWriteTarget: true,
      requiredWriteParameters: [
        "OPTICAL_ALARM_SELECTION",
        "DURATION_UNIT",
        "DURATION_VALUE",
      ],
      transform: "boolean",
      writeStrategy: "siren-default",
    },
    SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK,
  ],
};

const CLIMATE_BINDINGS: DeviceProfile["bindings"] = [
  {
    capability: "measure_temperature",
    channel: 1,
    parameter: "ACTUAL_TEMPERATURE",
  },
  { capability: "measure_humidity", channel: 1, parameter: "HUMIDITY" },
  {
    capability: "target_temperature",
    channel: 1,
    parameter: "SET_POINT_TEMPERATURE",
  },
  {
    capability: "homematic_thermostat_mode",
    channel: 1,
    parameter: "SET_POINT_MODE",
    setParameter: "CONTROL_MODE",
    transform: "enum-number-to-string",
  },
  {
    capability: "homematic_thermostat_boost",
    channel: 1,
    parameter: "BOOST_MODE",
  },
  {
    capability: "homematic_thermostat_weekprofile",
    channel: 1,
    parameter: "ACTIVE_PROFILE",
    transform: "enum-number-to-string",
  },
];

export const HMIP_CLIMATE_PROFILE: DeviceProfile = {
  id: "hmip-climate",
  driverId: "HmIP-STH",
  deviceTypes: ["HmIP-STH"],
  bindings: CLIMATE_BINDINGS,
};

const HMIP_WTH_PROFILE: DeviceProfile = {
  id: "hmip-wth",
  driverId: "HMIP-WTH",
  deviceTypes: ["HMIP-WTH", "HmIP-WTH"],
  bindings: CLIMATE_BINDINGS,
};

const HMIP_BWTH_PROFILE: DeviceProfile = {
  id: "hmip-bwth",
  driverId: "HmIP-BWTH",
  deviceTypes: ["HmIP-BWTH"],
  bindings: CLIMATE_BINDINGS,
};

const HMIP_STHD_PROFILE: DeviceProfile = {
  id: "hmip-sthd",
  driverId: "HmIP-STHD",
  deviceTypes: ["HmIP-STHD"],
  bindings: CLIMATE_BINDINGS,
};

const HMIP_STHO_PROFILE: DeviceProfile = {
  id: "hmip-stho",
  driverId: "HmIP-STHO",
  deviceTypes: ["HmIP-STHO"],
  bindings: [
    {
      capability: "measure_temperature",
      channel: 1,
      parameter: "ACTUAL_TEMPERATURE",
    },
    { capability: "measure_humidity", channel: 1, parameter: "HUMIDITY" },
    SENSOR_MAINTENANCE_BINDING,
  ],
};

const THERMOSTAT_BINDINGS: DeviceProfile["bindings"] = [
  SENSOR_MAINTENANCE_BINDING,
  ...CLIMATE_BINDINGS.filter(
    (binding) => binding.capability !== "measure_humidity",
  ),
  {
    capability: "homematic_measure_valve",
    channel: 1,
    parameter: "LEVEL",
    transform: "ratio-to-percent",
  },
];

export const HMIP_THERMOSTAT_PROFILE: DeviceProfile = {
  id: "hmip-radiator-thermostat",
  driverId: "HmIP-eTRV-2",
  deviceTypes: ["HmIP-eTRV-2"],
  bindings: THERMOSTAT_BINDINGS,
};

const HMIP_ETRV_PROFILE: DeviceProfile = {
  id: "hmip-etrv",
  driverId: "HMIP-eTRV",
  deviceTypes: ["HMIP-eTRV", "HmIP-eTRV"],
  bindings: THERMOSTAT_BINDINGS,
};

const HMIP_ETRV_B_PROFILE: DeviceProfile = {
  id: "hmip-etrv-b",
  driverId: "HmIP-eTRV-B",
  deviceTypes: ["HmIP-eTRV-B"],
  bindings: THERMOSTAT_BINDINGS,
};

const HMIP_ETRV_B_2_PROFILE: DeviceProfile = {
  id: "hmip-etrv-b-2",
  driverId: "HmIP-eTRV-B-2",
  deviceTypes: ["HmIP-eTRV-B-2"],
  bindings: THERMOSTAT_BINDINGS,
};

const HMIP_ETRV_C_PROFILE: DeviceProfile = {
  id: "hmip-etrv-c",
  driverId: "HmIP-eTRV-C",
  deviceTypes: ["HmIP-eTRV-C"],
  bindings: THERMOSTAT_BINDINGS,
};

const HMIP_ETRV_E_PROFILE: DeviceProfile = {
  id: "hmip-etrv-e",
  driverId: "HmIP-eTRV-E",
  deviceTypes: ["HmIP-eTRV-E", "HmIP-eTRV-E-A"],
  bindings: THERMOSTAT_BINDINGS,
};

export const HMIP_COVER_PROFILE: DeviceProfile = {
  id: "hmip-cover",
  driverId: "HmIP-BROLL",
  deviceTypes: ["HmIP-BROLL"],
  bindings: [
    {
      capability: "windowcoverings_set",
      channel: 3,
      parameter: "LEVEL",
      setChannel: 4,
      setParameter: "LEVEL",
    },
    {
      capability: "windowcoverings_state",
      channel: 3,
      parameter: "ACTIVITY_STATE",
      setChannel: 4,
      setParameter: "LEVEL",
      writeStrategy: "cover-state",
      transform: "activity-state-to-cover-state",
    },
  ],
};

const HMIP_FROLL_PROFILE: DeviceProfile = {
  ...HMIP_COVER_PROFILE,
  id: "hmip-froll",
  driverId: "HmIP-FROLL",
  deviceTypes: ["HmIP-FROLL"],
};

const BLIND_BINDINGS: DeviceProfile["bindings"] = [
  ...HMIP_COVER_PROFILE.bindings,
  {
    capability: "windowcoverings_tilt_set",
    channel: 3,
    parameter: "LEVEL_2",
    setChannel: 4,
    setParameter: "LEVEL_2",
  },
];

const HMIP_FBL_PROFILE: DeviceProfile = {
  id: "hmip-fbl",
  driverId: "HmIP-FBL",
  deviceTypes: ["HmIP-FBL"],
  bindings: BLIND_BINDINGS,
};

const HMIP_BBL_PROFILE: DeviceProfile = {
  id: "hmip-bbl",
  driverId: "HmIP-BBL",
  deviceTypes: ["HmIP-BBL"],
  bindings: BLIND_BINDINGS,
  buttonChannels: [1, 2],
};

const HMIP_DLD_PROFILE: DeviceProfile = {
  id: "hmip-dld",
  driverId: "HmIP-DLD",
  deviceTypes: ["HmIP-DLD"],
  bindings: [
    SENSOR_MAINTENANCE_BINDING_WITH_FALLBACK,
    {
      capability: "locked",
      channel: 1,
      parameter: "LOCK_STATE",
      setParameter: "LOCK_TARGET_LEVEL",
      transform: "lock-state-to-boolean",
    },
  ],
};

const GARAGE_BINDINGS: DeviceProfile["bindings"] = [
  {
    capability: "garagedoor_closed",
    channel: 1,
    parameter: "DOOR_STATE",
    setParameter: "DOOR_COMMAND",
    transform: "garage-door-state-to-closed",
    writeStrategy: "garage-closed",
  },
];

const HMIP_MOD_HO_PROFILE: DeviceProfile = {
  id: "hmip-mod-ho",
  driverId: "HmIP-MOD-HO",
  deviceTypes: ["HmIP-MOD-HO"],
  bindings: [...GARAGE_BINDINGS, ...switchBindings(2)],
};

const HMIP_MOD_TM_PROFILE: DeviceProfile = {
  id: "hmip-mod-tm",
  driverId: "HmIP-MOD-TM",
  deviceTypes: ["HmIP-MOD-TM"],
  bindings: GARAGE_BINDINGS,
};

export const HMIP_PROFILES = [
  HMIP_SWITCH_PROFILE,
  HMIP_PCBS_PROFILE,
  HMIP_PCBS_BAT_PROFILE,
  HMIP_DRSI1_PROFILE,
  HMIP_DRSI4_PROFILE,
  HMIP_MOD_OC8_PROFILE,
  HMIP_FSI_PROFILE,
  HMIP_FSI6_PROFILE,
  HMIP_FSI16_PROFILE,
  HMIP_FS6_PROFILE,
  HMIP_USBSM_PROFILE,
  HMIP_WGC_PROFILE,
  HMIP_PCBS2_PROFILE,
  HMIP_BS2_PROFILE,
  HMIP_WHS2_PROFILE,
  HMIP_WSM_PROFILE,
  HMIP_BDT_PROFILE,
  HMIP_FDT_PROFILE,
  HMIP_PDT_PROFILE,
  HMIP_DRDI3_PROFILE,
  HMIP_DRG_DALI_PROFILE,
  HMIP_RGBW_PROFILE,
  HMIP_BSM_PROFILE,
  HMIP_FSM_PROFILE,
  HMIP_FSM16_PROFILE,
  HMIP_POWER_METER_PROFILE,
  HMIP_CONTACT_PROFILE,
  HMIP_SWDO_I_PROFILE,
  HMIP_SWDM_PROFILE,
  HMIP_SRH_PROFILE,
  HMIP_CONTACT_2_PROFILE,
  HMIP_WEATHER_PROFILE,
  HMIP_LIGHT_SENSOR_PROFILE,
  HMIP_TEMPERATURE_SENSOR_PROFILE,
  HMIP_SCTH230_PROFILE,
  HMIP_SMI_PROFILE,
  HMIP_SMI55_PROFILE,
  HMIP_BRC2_PROFILE,
  HMIP_WRC2_PROFILE,
  HMIP_WRC6_PROFILE,
  HMIP_RC8_PROFILE,
  HMIP_SMO_A_PROFILE,
  HMIP_SPI_PROFILE,
  HMIP_SAM_PROFILE,
  HMIP_SWD_PROFILE,
  HMIP_SWSD_PROFILE,
  HMIP_ASIR_PROFILE,
  HMIP_CLIMATE_PROFILE,
  HMIP_WTH_PROFILE,
  HMIP_BWTH_PROFILE,
  HMIP_STHD_PROFILE,
  HMIP_STHO_PROFILE,
  HMIP_THERMOSTAT_PROFILE,
  HMIP_ETRV_PROFILE,
  HMIP_ETRV_B_PROFILE,
  HMIP_ETRV_B_2_PROFILE,
  HMIP_ETRV_C_PROFILE,
  HMIP_ETRV_E_PROFILE,
  HMIP_COVER_PROFILE,
  HMIP_FROLL_PROFILE,
  HMIP_FBL_PROFILE,
  HMIP_BBL_PROFILE,
  HMIP_DLD_PROFILE,
  HMIP_MOD_HO_PROFILE,
  HMIP_MOD_TM_PROFILE,
] as const;
