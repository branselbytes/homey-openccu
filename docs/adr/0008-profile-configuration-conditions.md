# ADR 0008: Profile configuration conditions

## Status

Accepted

## Context

Some HmIP products expose a channel layout whose meaning depends on MASTER configuration. HmIP-RGBW uses `DEVICE_OPERATION_MODE` to select one RGB/RGBW light, two tunable-white outputs, or four PWM outputs. VALUES descriptions alone contain datapoints for channels that are not usable in the selected mode.

Reading every MASTER paramset during normal discovery would add substantial XML-RPC load and expose configuration unrelated to capability mapping. Treating every described channel as active would create unusable Homey devices.

## Decision

A device profile may declare the exact MASTER configuration parameters required for mapping. Discovery groups those declarations by channel, reads only the requested MASTER descriptions and values under the existing concurrency limit, and normalizes numeric ENUM values through their metadata `VALUE_LIST`.

Logical-device and binding definitions may contain equality conditions against the normalized configuration. Failed or missing configuration reads are retained as discovery issues. A profile may define a conservative unconditional subset as fallback; HmIP-RGBW exposes only channel 1 as a plain dimmer when its mode is unavailable.

Configuration values remain separate from runtime VALUES datapoints. They select pairing topology and are refreshed with device discovery; they are not subscribed as ordinary device state.

## Consequences

- Mode-dependent products expose only usable Homey devices and capabilities.
- Ordinary devices incur no additional MASTER requests.
- Adding another conditional product requires an explicit, reviewed parameter declaration and fixtures for each supported mode.
- A configuration change requires discovery and may alter the set of pairable logical devices; already paired devices need reconciliation policy if their logical output becomes invalid.
- Diagnostics must continue to redact configuration values that may contain user-sensitive data.
