import type { DeviceProfile } from "./types";

export const HMIP_SWITCH_PROFILE: DeviceProfile = {
  id: "hmip-switch",
  driverId: "HMIP-PS",
  deviceTypes: [
    "HMIP-PS",
    "HmIP-PS",
    "HmIP-PCBS",
    "HmIP-PCBS-BAT",
    "HmIP-DRSI1",
  ],
  bindings: [{ capability: "onoff", channel: 3, parameter: "STATE" }],
};

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

export const HMIP_CONTACT_PROFILE: DeviceProfile = {
  id: "hmip-contact",
  driverId: "HMIP-SWDO",
  deviceTypes: [
    "HMIP-SWDO",
    "HmIP-SWDO",
    "HmIP-SWDO-I",
    "HmIP-SWDM",
    "HmIP-SRH",
  ],
  bindings: [
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
  ],
};

const SENSOR_MAINTENANCE_BINDING = {
  capability: "alarm_battery",
  channel: 0,
  parameter: "LOW_BAT",
  transform: "boolean",
} as const;

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

export const HMIP_CLIMATE_PROFILE: DeviceProfile = {
  id: "hmip-climate",
  driverId: "HmIP-STH",
  deviceTypes: [
    "HMIP-WTH",
    "HmIP-WTH",
    "HmIP-STH",
    "HmIP-STHD",
    "HmIP-STHO",
    "HmIP-BWTH",
  ],
  bindings: [
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
  ],
};

export const HMIP_THERMOSTAT_PROFILE: DeviceProfile = {
  id: "hmip-radiator-thermostat",
  driverId: "HmIP-eTRV-2",
  deviceTypes: [
    "HMIP-eTRV",
    "HmIP-eTRV",
    "HmIP-eTRV-2",
    "HmIP-eTRV-B",
    "HmIP-eTRV-B-2",
    "HmIP-eTRV-C",
    "HmIP-eTRV-E",
    "HmIP-eTRV-E-A",
  ],
  bindings: [
    {
      capability: "alarm_battery",
      channel: 0,
      parameter: "LOW_BAT",
      transform: "boolean",
    },
    ...HMIP_CLIMATE_PROFILE.bindings.filter(
      (binding) => binding.capability !== "measure_humidity",
    ),
    {
      capability: "homematic_measure_valve",
      channel: 1,
      parameter: "LEVEL",
      transform: "ratio-to-percent",
    },
  ],
};

export const HMIP_COVER_PROFILE: DeviceProfile = {
  id: "hmip-cover",
  driverId: "HmIP-BROLL",
  deviceTypes: ["HmIP-BROLL", "HmIP-FROLL", "HmIP-FBL"],
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
    },
  ],
};

export const HMIP_PROFILES = [
  HMIP_SWITCH_PROFILE,
  HMIP_POWER_METER_PROFILE,
  HMIP_CONTACT_PROFILE,
  HMIP_CONTACT_2_PROFILE,
  HMIP_WEATHER_PROFILE,
  HMIP_LIGHT_SENSOR_PROFILE,
  HMIP_TEMPERATURE_SENSOR_PROFILE,
  HMIP_CLIMATE_PROFILE,
  HMIP_THERMOSTAT_PROFILE,
  HMIP_COVER_PROFILE,
] as const;
