# ADR 0013: Isolated VirtualDevices interface for heating groups

## Status

Accepted

## Context

OpenCCU exposes HmIP heating groups as virtual devices of type `HmIP-HEATING`. They are not part of the HmIP-RF XML-RPC inventory: they use the `VirtualDevices` interface on port 9292 and the `/groups` path. A group has a `HEATING_CLIMATECONTROL_TRANSCEIVER` channel whose temperature, humidity, setpoint, mode, boost, and active-profile datapoints largely mirror an HmIP thermostat.

Treating the group as an HmIP-RF device would route commands to the wrong endpoint. Coupling both interfaces to one connection state would also make all physical devices unavailable if only the optional group service failed.

## Decision

Each configured OpenCCU central owns an HmIP-RF runtime and an independently supervised VirtualDevices runtime. They use distinct callback ports, defaulting to 12010 and 12011. The VirtualDevices client uses port 9292 and `/groups`; all ports remain configurable. Pairing combines candidates from both runtimes, while each paired identity stores its interface ID so reads, writes, and callbacks return to the correct client.

`HmIP-HEATING` resolves only to the dedicated `openccu-heating-group` thermostat driver. Its initial profile exposes discovered temperature, humidity, target temperature, mode, boost, and week-profile datapoints from channel 1. Unsupported datapoints are omitted by discovery. Valve/activity and window aggregation are deferred because OpenCCU does not reliably publish all such virtual values for every group composition.

Homey offers only fixed device classes rather than app-defined categories. The driver therefore uses `other` in the add-device selector and is named “OpenCCU Groups”. Its pairing result overrides the created device to `thermostat`, retaining thermostat controls and integrations after the selection step.

The HmIP-RF runtime remains the owner of JSON-RPC metadata and central-level operations. Its normalized names are reused for VirtualDevices pairing candidates.

## Consequences

- Heating-group commands use XML-RPC and receive push callbacks through the required VirtualDevices interface.
- Heating groups are visually separated from physical thermostat drivers during device selection without losing their paired thermostat class.
- A VirtualDevices outage cannot disconnect physical HmIP-RF devices.
- One additional callback listener and one independently bounded discovery/reconnect loop run per configured central.
- Existing settings gain compatible defaults; users only need to change them for nonstandard OpenCCU ports or local port conflicts.
- Initial reads and callbacks must be hardware-tested because VirtualDevices has known differences from physical-device services, especially after an OpenCCU restart.
