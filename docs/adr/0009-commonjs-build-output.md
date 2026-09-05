# ADR 0009: CommonJS build output

## Status

Accepted

## Context

The Homey app entry point is loaded from `app.js`, while production sources and drivers are authored in strict TypeScript. Changing module format at the same time as the ongoing behavioral migration would add loader and package-resolution risk without improving the OpenCCU boundaries.

## Decision

Compile TypeScript to CommonJS for the current Homey Apps SDK v3 runtime. Keep generated JavaScript in `.homeybuild/` as an ignored, reproducible build artifact and retain TypeScript as the only reviewed production source.

Reconsider native ESM only when Homey's documented app runtime and tooling provide a concrete benefit and the change can be tested independently.

## Consequences

- Local development, CI, and Homey validation all build from the same TypeScript sources.
- Generated output is never committed and cannot drift from source.
- Runtime imports remain compatible with the current `export =` Homey app entry point.
- A future ESM migration is an explicit tooling change rather than an incidental part of device work.
