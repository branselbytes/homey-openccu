import { HMIP_PROFILES } from "./hmip";
import { ADDITIONAL_PROFILES } from "./additional-devices";
import type {
  DeviceProfile,
  LogicalDeviceProfile,
  ProfileBinding,
} from "./types";

// Independently authored channel maps; evidence and limits in ADR 0030.
function family(model: string, models: readonly string[]): DeviceProfile {
  const base = [...HMIP_PROFILES, ...ADDITIONAL_PROFILES].find((p) =>
    p.deviceTypes.includes(model),
  );
  if (!base) throw new Error(`Missing base profile: ${model}`);
  return {
    ...base,
    id: `${models[0]?.toLowerCase() ?? base.id}-catalog`,
    deviceTypes: models,
  };
}
const battery: ProfileBinding = {
  capability: "alarm_battery",
  channel: 0,
  parameter: "LOW_BAT",
  readOnly: true,
  transform: "boolean",
};
function sensor(
  capability: string,
  channel: number,
  parameter: string,
  transform: ProfileBinding["transform"] = "identity",
): ProfileBinding {
  return { capability, channel, parameter, readOnly: true, transform };
}
function control(
  capability: string,
  channel: number,
  parameter: string,
  setChannel = channel,
  transform: ProfileBinding["transform"] = "identity",
): ProfileBinding {
  return {
    capability,
    channel,
    parameter,
    setChannel,
    requiresWriteTarget: true,
    transform,
  };
}
function profile(
  model: string,
  bindings: readonly ProfileBinding[],
  buttonChannels?: readonly number[],
): DeviceProfile {
  return {
    id: model.toLowerCase(),
    driverId: model,
    deviceTypes: [model],
    bindings,
    ...(buttonChannels ? { buttonChannels } : {}),
  };
}
function buttons(model: string, count: number): DeviceProfile {
  return profile(
    model,
    [battery],
    Array.from({ length: count }, (_, i) => i + 1),
  );
}
function logical(
  model: string,
  logicalDevices: readonly LogicalDeviceProfile[],
): DeviceProfile {
  return { ...profile(model, []), logicalDevices };
}
function switches(channels: readonly number[]): LogicalDeviceProfile[] {
  return channels.map((channel, i) => ({
    id: `output-${i + 1}`,
    nameSuffix: `Output ${i + 1}`,
    nameChannel: channel,
    bindings: [control("onoff", channel, "STATE", channel + 1, "boolean")],
  }));
}
function light(channel: number, write = channel): ProfileBinding[] {
  return [
    control("onoff", channel, "LEVEL", write, "positive-number-to-boolean"),
    control("dim", channel, "LEVEL", write),
  ];
}
function blinds(
  channels: readonly number[],
  offset = 1,
): LogicalDeviceProfile[] {
  return channels.map((channel, i) => ({
    id: `output-${i + 1}`,
    nameSuffix: `Blind ${i + 1}`,
    nameChannel: channel,
    bindings: [
      control("windowcoverings_set", channel, "LEVEL", channel + offset),
      control("windowcoverings_tilt_set", channel, "LEVEL_2", channel + offset),
      {
        ...control(
          "windowcoverings_state",
          channel,
          "ACTIVITY_STATE",
          channel + offset,
          "activity-state-to-cover-state",
        ),
        setParameter: "LEVEL",
        requiredWriteParameters: ["STOP"],
        writeStrategy: "cover-state",
      },
    ],
  }));
}
function inputs(channels: readonly number[]): LogicalDeviceProfile[] {
  return channels.map((channel) => ({
    id: `input-${channel}`,
    nameSuffix: `Input ${channel}`,
    nameChannel: channel,
    bindings: [
      {
        ...sensor("alarm_contact", channel, "STATE", "boolean"),
        conditions: [
          {
            channel,
            parameter: "CHANNEL_OPERATION_MODE",
            oneOf: ["BINARY_BEHAVIOR"],
          },
        ],
      },
    ],
    buttonChannels: [channel],
    buttonConditions: [
      {
        channel,
        parameter: "CHANNEL_OPERATION_MODE",
        oneOf: ["KEY_BEHAVIOR", "SWITCH_BEHAVIOR"],
      },
    ],
  }));
}
function withInputs(
  model: string,
  channels: readonly number[],
  outputs: readonly LogicalDeviceProfile[] = [],
): DeviceProfile {
  return {
    ...logical(model, [...inputs(channels), ...outputs]),
    configurationParameters: channels.map((channel) => ({
      channel,
      parameter: "CHANNEL_OPERATION_MODE",
    })),
  };
}
function floor(model: string, count: number): DeviceProfile {
  return logical(
    model,
    Array.from({ length: count }, (_, i) => ({
      id: `valve-${i + 1}`,
      nameSuffix: `Heating output ${i + 1}`,
      nameChannel: i + 1,
      bindings: [
        sensor("homematic_valve_active", i + 1, "STATE", "boolean"),
        sensor("alarm_generic.dew_point", i + 1, "DEW_POINT_ALARM", "boolean"),
        sensor(
          "alarm_generic.emergency",
          i + 1,
          "EMERGENCY_OPERATION",
          "boolean",
        ),
      ],
    })),
  );
}
function climate(model: string, channel = 1): DeviceProfile {
  const base = family("HmIPW-STH", [model]);
  return {
    ...base,
    id: model.toLowerCase(),
    driverId: model,
    bindings: [
      ...base.bindings.map((b) => ({ ...b, channel })),
      sensor("measure_co2", channel, "CONCENTRATION"),
    ],
  };
}
export const CATALOG_PROFILES: readonly DeviceProfile[] = [
  family("HmIP-SWDO", ["HmIP-SWDO-PL", "HmIP-SWDO-PL-2"]),
  family("HmIP-WTH", [
    "HmIP-WT",
    "HmIP-WTH-B",
    "HmIP-WTH-B-2",
    "HmIP-WTH-B-A",
    "HmIP-WTH-3",
    "HmIP-WTH-3-A",
  ]),
  family("HmIP-eTRV-2", ["HmIP-eTRV-CL", "HmIP-eTRV-3"]),
  {
    ...family("HmIP-FALMOT-C12", ["HmIP-FALMOT-C8"]),
    id: "hmip-falmot-c8",
    logicalDevices: family("HmIP-FALMOT-C12", []).logicalDevices!.slice(0, 8),
  },
  withInputs("HmIP-FCI6", [1, 2, 3, 4, 5, 6]),
  withInputs(
    "HmIP-WRC6-230",
    [7],
    [
      { ...switches([8])[0], buttonChannels: [1, 2, 3, 4, 5, 6] },
      ...[12, 13, 14, 15, 16, 17, 18].map((channel) => ({
        id: `led-${channel}`,
        nameSuffix: `LED ${channel - 11}`,
        nameChannel: channel,
        bindings: [
          ...light(channel),
          control(
            "homematic_signal_color",
            channel,
            "COLOR",
            channel,
            "signal-color",
          ),
        ],
      })),
    ],
  ),
  logical("HmIP-WGT", [
    {
      id: "climate",
      nameSuffix: "Climate",
      nameChannel: 8,
      bindings: climate("HmIP-WGT", 8).bindings,
      buttonChannels: [1],
    },
    ...switches([3]),
    {
      id: "backlight",
      nameSuffix: "Backlight",
      nameChannel: 2,
      bindings: light(2),
    },
  ]),
  family("HmIP-ASIR", ["HmIP-ASIR-2", "HmIP-ASIR-O"]),
  family("HmIP-SMO-A", ["HmIP-SMO", "HmIP-SMO-2"]),
  family("HmIP-SAM", ["HmIP-STV"]),
  family("HmIP-STHO", ["HmIP-STHO-A"]),
  family("HmIP-SWDM", ["HmIP-SWDM-B2"]),
  family("HmIP-SWSD", ["HmIP-SWSD-2"]),
  family("HmIP-WTH", ["HmIP-WTH-1", "HmIP-WTH-2"]),
  family("HmIP-eTRV-2", ["HmIP-eTRV-B1", "HmIP-eTRV-C-2", "HmIP-eTRV-F"]),
  family("HmIP-PSM", ["HmIP-PSMCO"]),
  family("HmIP-FALMOT-C12", ["HmIPW-FALMOT-C12"]),
  family("HmIP-SMI55", ["HmIPW-SMI55"]),
  ...["HmIP-KRC4", "HmIP-KRCA"].map((m) => buttons(m, 4)),
  ...["HmIP-DBB", "HmIP-RCB1"].map((m) => buttons(m, 1)),
  buttons("HmIP-MOD-RC8", 8),
  buttons("HmIP-RCV-50", 50),
  buttons("HmIP-WRCR", 3),
  withInputs("HmIP-DSD-PCB", [1]),
  withInputs(
    "HmIPW-DRI32",
    Array.from({ length: 32 }, (_, i) => i + 1),
  ),
  withInputs(
    "HmIPW-FIO6",
    [1, 2, 3, 4, 5, 6],
    switches([7, 11, 15, 19, 23, 27]),
  ),
  withInputs("HmIP-DRBLI4", [1, 2, 3, 4, 5, 6, 7, 8], blinds([9, 13, 17, 21])),
  logical("HmIPW-DRBL4", blinds([1, 5, 9, 13])),
  logical(
    "HmIPW-DRD3",
    [1, 5, 9].map((channel, i) => ({
      id: `output-${i + 1}`,
      nameSuffix: `Dimmer ${i + 1}`,
      nameChannel: channel,
      bindings: light(channel, channel + 1),
    })),
  ),
  ...["HmIP-HDM1", "HmIP-HDM2"].map((model) =>
    profile(model, blinds([1], 0)[0].bindings),
  ),
  withInputs(
    "HmIP-MIO16-PCB",
    [13, 14, 15, 16],
    [
      ...switches([17, 21, 25, 29, 33, 37, 41, 45]),
      ...[1, 4, 7, 10].map((channel, i) => ({
        id: `analog-${i + 1}`,
        nameSuffix: `Voltage ${i + 1}`,
        nameChannel: channel,
        bindings: [sensor("measure_voltage", channel, "VOLTAGE")],
      })),
    ],
  ),
  floor("HmIP-FAL230-C10", 10),
  floor("HmIPW-FAL230-C6", 6),
  ...["HmIPW-STHD", "HmIPW-WTH", "HmIPW-SCTHD"].map((m) => climate(m)),
  profile("HmIP-DLS", [
    sensor("homematic_lock_state", 1, "LOCK_STATE", "lock-sensor-state"),
    battery,
  ]),
  {
    ...profile(
      "HmIP-DLP",
      [
        {
          ...control("locked", 12, "LOCK_STATE", 12, "lock-state-to-boolean"),
          setParameter: "LOCK_TARGET_LEVEL",
        },
        sensor("alarm_contact", 3, "STATE", "boolean"),
        battery,
      ],
      [1],
    ),
  },
  profile("HmIP-PMFS", [
    sensor("alarm_generic.power_failure", 1, "POWER_MAINS_FAILURE", "boolean"),
    battery,
  ]),
  profile("HmIP-SRD", [
    sensor("alarm_water", 1, "RAINING", "boolean"),
    sensor("measure_temperature", 1, "ACTUAL_TEMPERATURE"),
    sensor("homematic_heater_active", 1, "HEATER_STATE", "boolean"),
  ]),
  profile("HmIP-SFD", [
    sensor("measure_temperature", 1, "ACTUAL_TEMPERATURE"),
    sensor("measure_humidity", 1, "HUMIDITY"),
    ...[
      ["pm1", "MASS_CONCENTRATION_PM_1"],
      ["pm25", "MASS_CONCENTRATION_PM_2_5"],
      ["pm10", "MASS_CONCENTRATION_PM_10"],
    ].map(([id, param]) => sensor(`homematic_particulate.${id}`, 1, param)),
    battery,
  ]),
  logical(
    "HmIP-SPDR",
    [2, 3].map((channel) => ({
      id: `passage-${channel}`,
      nameSuffix: `Passage ${channel - 1}`,
      nameChannel: channel,
      bindings: [
        sensor("homematic_passage_count", channel, "PASSAGE_COUNTER_VALUE"),
        sensor(
          "alarm_generic.overflow",
          channel,
          "PASSAGE_COUNTER_OVERFLOW",
          "boolean",
        ),
        sensor(
          "homematic_passage_direction",
          channel,
          "CURRENT_PASSAGE_DIRECTION",
          "boolean",
        ),
        battery,
      ],
    })),
  ),
  profile("HmIP-LSC", [
    ...light(1),
    control("light_hue", 1, "HUE", 1, "hue-degrees-to-ratio"),
    control("light_saturation", 1, "SATURATION"),
  ]),
  logical("HmIP-SMO230-A", [
    {
      id: "motion",
      nameSuffix: "Motion",
      nameChannel: 4,
      bindings: [
        sensor("alarm_motion", 4, "MOTION", "boolean"),
        sensor("measure_luminance", 4, "ILLUMINATION"),
      ],
    },
    ...switches([9]),
  ]),
  logical("HmIP-BSL", [
    { ...switches([3])[0], buttonChannels: [1, 2] },
    ...[7, 11].map((channel, i) => ({
      id: `led-${i + 1}`,
      nameSuffix: `LED ${i + 1}`,
      nameChannel: channel,
      bindings: [
        ...light(channel, channel + 1),
        control(
          "homematic_signal_color",
          channel,
          "COLOR",
          channel + 1,
          "signal-color",
        ),
      ],
    })),
  ]),
  withInputs(
    "HmIP-UDI-SMI55",
    [3],
    [
      {
        id: "motion",
        nameSuffix: "Motion",
        nameChannel: 4,
        buttonChannels: [1, 2],
        bindings: [
          sensor("alarm_motion", 4, "MOTION", "boolean"),
          sensor("measure_luminance", 4, "ILLUMINATION"),
        ],
      },
      {
        id: "dimmer",
        nameSuffix: "Dimmer",
        nameChannel: 6,
        bindings: light(6, 7),
      },
    ],
  ),
  logical("HmIP-WGTC", [
    {
      id: "climate",
      nameSuffix: "Climate",
      nameChannel: 8,
      bindings: climate("HmIP-WGTC", 8).bindings,
      buttonChannels: [1],
    },
    ...switches([3]),
    {
      id: "backlight",
      nameSuffix: "Backlight",
      nameChannel: 2,
      bindings: light(2),
    },
  ]),
  logical("HmIPW-WRC6", [
    {
      id: "buttons",
      nameSuffix: "Buttons",
      bindings: [battery],
      buttonChannels: [1, 2, 3, 4, 5, 6],
    },
    ...[7, 8, 9, 10, 11, 12, 13].map((channel) => ({
      id: `led-${channel}`,
      nameSuffix: `LED ${channel - 6}`,
      nameChannel: channel,
      bindings: [
        ...light(channel),
        control(
          "homematic_signal_color",
          channel,
          "COLOR",
          channel,
          "signal-color",
        ),
      ],
    })),
  ]),

  profile("HmIP-ESI", [
    sensor("measure_power", 1, "POWER"),
    sensor("meter_power", 2, "ENERGY_COUNTER", "watt-hour-to-kilowatt-hour"),
    sensor(
      "meter_power.tariff1",
      3,
      "ENERGY_COUNTER",
      "watt-hour-to-kilowatt-hour",
    ),
    sensor(
      "meter_power.tariff2",
      4,
      "ENERGY_COUNTER",
      "watt-hour-to-kilowatt-hour",
    ),
    sensor("meter_gas", 2, "GAS_VOLUME"),
    sensor("homematic_gas_flow", 1, "GAS_FLOW"),
    battery,
  ]),
  profile(
    "HmIP-WKP",
    [battery, sensor("alarm_tamper", 0, "SABOTAGE", "boolean")],
    Array.from({ length: 16 }, (_, i) => i + 1),
  ),
  logical("HmIP-FWI", [
    ...switches([9]),
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `access-${i + 1}`,
      nameSuffix: `Access ${i + 1}`,
      nameChannel: i + 1,
      bindings: [sensor("alarm_contact", i + 1, "STATE", "boolean")],
    })),
  ]),
  profile(
    "HmIP-WRCD",
    [
      battery,
      ...Array.from({ length: 5 }, (_, i) => ({
        ...control(
          `homematic_display_text.line${i + 1}`,
          3,
          "DISPLAY_DATA_STRING",
        ),
        requiredWriteParameters: [
          "DISPLAY_DATA_ID",
          "DISPLAY_DATA_COMMIT",
          "DISPLAY_DATA_ALIGNMENT",
          "DISPLAY_DATA_BACKGROUND_COLOR",
          "DISPLAY_DATA_TEXT_COLOR",
          "DISPLAY_DATA_ICON",
        ],
        writeStrategy: "display-text" as const,
      })),
    ],
    [1, 2],
  ),
  logical("HmIP-MP3P", [
    {
      id: "sound",
      nameSuffix: "Sound",
      nameChannel: 1,
      bindings: [
        control("volume_set", 1, "LEVEL", 2),
        {
          ...control("homematic_sound_file", 1, "SOUNDFILE", 2, "sound-file"),
          writeStrategy: "sound-file",
          requiredWriteParameters: ["LEVEL", "DURATION_UNIT", "DURATION_VALUE"],
        },
        sensor(
          "homematic_playing",
          0,
          "STATUS_FLAG_PLAYING_FILE_ACTIVE",
          "boolean",
        ),
        { ...control("button.stop", 2, "STOP"), transform: "boolean" },
      ],
    },
    {
      id: "led",
      nameSuffix: "LED",
      nameChannel: 5,
      bindings: [
        ...light(5, 6),
        control("homematic_signal_color", 5, "COLOR", 6, "signal-color"),
      ],
    },
  ]),
];
