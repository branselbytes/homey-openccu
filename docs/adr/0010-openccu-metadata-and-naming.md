# ADR 0010: OpenCCU metadata and pairing names

## Status

Accepted

## Context

XML-RPC device descriptions contain addresses and datapoints but not the user-facing names, rooms, functions, programs, and system variables maintained by OpenCCU. JSON-RPC metadata is useful for pairing and hub features, but it must not become a prerequisite for device control or callback delivery.

The live OpenCCU API exposes functions through `Subsection.getAll`; `Function.getAll` is not available on the tested system.

## Decision

Load device/channel names, rooms, functions, programs, and system variables through one authenticated JSON-RPC session after successful XML-RPC discovery. Each metadata method is isolated: unsupported or malformed metadata produces a bounded issue and an empty result for that section without changing XML-RPC connection health.

For newly paired Homey devices, use this name precedence:

1. an explicit OpenCCU name on the profile's logical channel;
2. the OpenCCU device name plus the profile suffix;
3. the discovered product type and address fallback.

Never rename an already paired Homey device automatically. User-chosen Homey names remain authoritative after pairing. Rooms and functions are retained in the typed runtime for diagnostics and later opt-in zone/tag behavior; they do not currently modify Homey zones.

## Consequences

- Pairing lists use familiar OpenCCU names without coupling control to JSON-RPC.
- Multi-output actors can use channel-specific names.
- Existing Homey naming choices are preserved.
- Programs and visible system variables feed hub-level Flow autocomplete, actions, and conditions; internal objects are filtered at the protocol boundary.
- Diagnostics expose only counts and issue counts, never names, values, or credentials.
