# OpenCCU for Homey

OpenCCU for Homey is an independent, open-source Homey Pro app for integrating Homematic IP devices locally through OpenCCU.

The typed local runtime and broad HmIP driver foundation are implemented. Pairing, callbacks, thermostat commands, reconnect behavior, and one weather-sensor driver have been validated on hardware, but the full device matrix and release-readiness checks are still pending. Devices from the predecessor Homey app will not be migrated; they will be paired again in this app.

## Planned scope

- current Homey Pro, Homey Apps SDK v3, and Node.js 22
- HmIP-RF for physical devices and the OpenCCU VirtualDevices interface for HmIP heating groups
- XML-RPC for device discovery, values, commands, and push events
- JSON-RPC for names, rooms, functions, programs, and system variables
- dedicated Homey drivers backed by shared profiles plus a generic fallback for unknown products
- optional same-subnet OpenCCU discovery in settings, with manual host entry for routed networks
- no required Home Assistant, Python, MQTT, CCU-Jack, or RedMatic runtime

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design, [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for staged delivery, [DEVICE_SUPPORT.md](DEVICE_SUPPORT.md) for device coverage, [COMPATIBILITY.md](COMPATIBILITY.md) for platform status, [BETA_TESTING.md](BETA_TESTING.md) for community testing, and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for setup and support guidance.

## Heating schedules (0.1.5)

Open the app settings and select a paired thermostat or heating group under **Heating profiles**. The same editor is available through **Repair** in the device's Homey settings. Choose a stored profile and weekday, adjust the end times and temperatures, or copy an existing day/profile into the draft. **Review and save** shows a review and requires confirmation before writing to OpenCCU.

Weekday buttons switch directly between days; a dot marks unsaved changes. End times and temperatures use compact rows, including on mobile. Expand **Copy days or profiles** for copying tools and **About this schedule** for device-specific limits and profile guidance.

The device defines the available profile slots and limits; the editor cannot create additional slots beyond them. Prefer the heating group when OpenCCU manages the room as a group. Editing a stored profile does not activate it, and some devices store more profiles than their active-profile control can select. The CCU/devices continue to execute the schedules independently of Homey.

Concurrent CCU changes require a reload before saving. A pending result means the CCU acknowledged the write but read-back has not confirmed it; refresh manually before making another change. Confirmation refers to CCU read-back, not physical-device delivery. Hardware writes and native Homey rendering remain a rollout test.

## Development

Prerequisites:

- Node.js 24 for the current Homey CLI
- npm
- a current Homey Pro for device-level testing
- a dedicated or recorded OpenCCU test fixture

Install and verify locally:

```sh
npm ci
npm run check
npm run build
npx homey app validate
```

The application itself targets the Node.js 22 runtime used by Homey software 12.9.0 and newer. Generated TypeScript output under `.homeybuild/` is not committed.

Do not publish, push releases, or modify the upstream repository without explicit project-owner approval.

Contributors should follow [CONTRIBUTING.md](CONTRIBUTING.md). Release preparation is tracked in [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md).

## History and license

This repository preserves the Git history of [LRuesink-WebArray/homey-matic](https://github.com/LRuesink-WebArray/homey-matic), originally developed by Timo Wendt with contributions from Bjoern Welker and others. The original repository remains configured as the `upstream` Git remote.

The project is distributed under the MIT License. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Concepts from the MIT-licensed `aiohomematic` and `homematicip_local` projects may be studied and independently adapted for TypeScript; they are not runtime dependencies.
