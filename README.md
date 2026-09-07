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
