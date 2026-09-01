# OpenCCU for Homey

OpenCCU for Homey is an independent, open-source Homey Pro app for integrating Homematic IP devices locally through OpenCCU.

The project is in its initial modernization phase and is not ready for installation or daily use. Devices from the predecessor Homey app will not be migrated; they will be paired again in this app.

## Planned scope

- current Homey Pro, Homey Apps SDK v3, and Node.js 22
- HmIP-RF in the first implementation
- XML-RPC for device discovery, values, commands, and push events
- JSON-RPC for names, rooms, functions, programs, and system variables
- one Homey driver per supported product plus a generic fallback for unknown products
- no required Home Assistant, Python, MQTT, CCU-Jack, or RedMatic runtime

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the staged delivery plan.

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

## History and license

This repository preserves the Git history of [LRuesink-WebArray/homey-matic](https://github.com/LRuesink-WebArray/homey-matic), originally developed by Timo Wendt with contributions from Bjoern Welker and others. The original repository remains configured as the `upstream` Git remote.

The project is distributed under the MIT License. See [LICENSE](LICENSE). Concepts from the MIT-licensed `aiohomematic` and `homematicip_local` projects may be studied and independently adapted for TypeScript; they are not runtime dependencies.
