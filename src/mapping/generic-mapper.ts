import type { MappingDecisionLog } from "./decision";
import type { CapabilityBinding, MappingContext, ValueTransform } from "./types";

interface GenericRule {
  readonly capability: string;
  readonly parameters: readonly string[];
  readonly channelTypes?: readonly string[];
  readonly writable?: boolean;
  readonly transform?: ValueTransform;
}

const RULES: readonly GenericRule[] = [
  { capability: "alarm_battery", parameters: ["LOW_BAT", "LOWBAT"], transform: "boolean" },
  { capability: "measure_temperature", parameters: ["ACTUAL_TEMPERATURE", "TEMPERATURE"] },
  { capability: "target_temperature", parameters: ["SET_POINT_TEMPERATURE"], writable: true },
  { capability: "measure_humidity", parameters: ["HUMIDITY"] },
  { capability: "measure_luminance", parameters: ["ILLUMINATION"] },
  { capability: "measure_power", parameters: ["POWER"] },
  { capability: "measure_voltage", parameters: ["VOLTAGE"] },
  { capability: "measure_current", parameters: ["CURRENT"], transform: "milliamp-to-amp" },
  {
    capability: "meter_power",
    parameters: ["ENERGY_COUNTER"],
    transform: "watt-hour-to-kilowatt-hour",
  },
  {
    capability: "onoff",
    parameters: ["STATE"],
    channelTypes: ["SWITCH", "MULTI_MODE_INPUT_TRANSMITTER"],
    writable: true,
    transform: "boolean",
  },
  {
    capability: "alarm_contact",
    parameters: ["STATE"],
    channelTypes: ["CONTACT", "SHUTTER_CONTACT", "SENSOR"],
    transform: "boolean",
  },
  {
    capability: "dim",
    parameters: ["LEVEL"],
    channelTypes: ["DIMMER", "DIMMER_VIRTUAL_RECEIVER"],
    writable: true,
  },
];

export function mapGenericDataPoint(
  context: MappingContext,
  decisions?: MappingDecisionLog,
): CapabilityBinding | undefined {
  const rule = RULES.find(
    (candidate) =>
      candidate.parameters.includes(context.dataPoint.parameter) &&
      (!candidate.channelTypes || candidate.channelTypes.includes(context.channel.type)) &&
      (!candidate.writable || context.dataPoint.writable),
  );
  if (!rule) {
    decisions?.add({
      channelAddress: context.channel.address,
      parameter: context.dataPoint.parameter,
      kind: "unsupported",
      reason: "No unambiguous generic Homey capability rule matched",
    });
    return undefined;
  }

  const binding: CapabilityBinding = {
    capability: rule.capability,
    channelAddress: context.channel.address,
    parameter: context.dataPoint.parameter,
    readable: context.dataPoint.readable,
    writable: context.dataPoint.writable && (rule.writable ?? false),
    ...(context.dataPoint.writable && (rule.writable ?? false)
      ? {
          writeChannelAddress: context.channel.address,
          writeParameter: context.dataPoint.parameter,
        }
      : {}),
    transform: rule.transform ?? "identity",
  };
  decisions?.add({
    channelAddress: context.channel.address,
    parameter: context.dataPoint.parameter,
    kind: "generic",
    capability: binding.capability,
    reason: `Matched ${context.channel.type}/${context.dataPoint.parameter}`,
  });
  return binding;
}

export function mapGenericDevice(
  device: MappingContext["device"],
  decisions?: MappingDecisionLog,
): readonly CapabilityBinding[] {
  const bindings: CapabilityBinding[] = [];
  const claimed = new Set<string>();
  for (const channel of device.channels.values()) {
    for (const dataPoint of channel.dataPoints.values()) {
      const binding = mapGenericDataPoint({ device, channel, dataPoint }, decisions);
      if (!binding || claimed.has(binding.capability)) continue;
      claimed.add(binding.capability);
      bindings.push(binding);
    }
  }
  return bindings;
}
