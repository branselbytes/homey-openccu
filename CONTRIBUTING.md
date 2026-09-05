# Contributing

Contributions are welcome. Keep changes focused and preserve the separation between protocol transport, OpenCCU domain model, capability mapping, profiles, Homey drivers, and diagnostics described in [ARCHITECTURE.md](ARCHITECTURE.md).

## Development setup

Use Node.js 24 for the current Homey CLI; the app runtime itself targets Homey's Node.js 22 environment.

```sh
npm ci
npm run check
npm run build
npx homey app validate --level publish
npm audit --omit=dev
```

Do not commit `.homeybuild`, credentials, diagnostic files containing private data, or captured responses before redaction. Do not push to `upstream`.

## Device support changes

Prefer a shared, typed profile over copied per-driver behavior. A new profile should include:

- exact product matching including observed suffix variants;
- discovery-gated channel/datapoint selection;
- standard Homey capabilities before custom capabilities;
- fixtures for mapping, conversion, commands, and callbacks;
- an entry in [DEVICE_SUPPORT.md](DEVICE_SUPPORT.md) stating fixture and hardware status.

Unknown devices must remain pairable through the generic driver. Do not copy Python from `aiohomematic` or `homematicip_local`; independently adapt concepts and review attribution for any substantial source-derived material.

## Change handoff

Describe behavior and architectural impact, list exact verification commands, and call out missing hardware coverage. Add a short ADR under `docs/adr/` for consequential decisions. Keep [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) and [ARCHITECTURE.md](ARCHITECTURE.md) aligned with the result.

Pushing, publishing, release creation, and external configuration changes require explicit project-owner approval.
