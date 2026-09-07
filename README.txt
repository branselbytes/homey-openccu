# OpenCCU Local

Connect Homematic IP devices directly and locally to your Homey Pro through OpenCCU. Device discovery, commands and push updates use the local XML-RPC interfaces; names, rooms, functions, programs, system variables and system information are loaded through JSON-RPC.

## Current beta scope

- Physical Homematic IP devices through HmIP-RF
- Homematic IP heating groups through VirtualDevices
- Dedicated drivers backed by shared device profiles
- Generic fallback for new or unknown products
- Flow cards for device actions, OpenCCU programs and system variables
- OpenCCU system device and dashboard widgets

The app does not require Home Assistant, MQTT, CCU-Jack or RedMatic. MQTT is not used by the current version.

## Requirements and setup

You need a Homey Pro running Homey software 12.9.0 or newer and an OpenCCU reachable from Homey's local network. Configure the OpenCCU host and XML-RPC callback ports in the app settings before pairing devices. Routed networks and VLANs must allow traffic in both directions.

This is a separate app. Devices from the previous Homematic Homey app are not migrated and must be paired again. Removing a device from Homey does not remove it from OpenCCU.

## Beta notice

This is an early test version. Many drivers are verified with automated fixtures but still need testing with real devices and firmware versions. Do not use the beta as the only control path for safety-critical functions.

When reporting an issue, include the app, Homey and OpenCCU versions, the product type and firmware, and reproducible steps. The app settings can create a sanitized diagnostics report containing device-model and mapping information. Review it before sharing. Never publish credentials, serial numbers, IP addresses, raw OpenCCU backups or unreviewed raw logs.

Source, documentation and support:
https://github.com/branselbytes/homey-openccu
