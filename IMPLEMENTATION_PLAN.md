# Implementation plan

This plan deliberately separates repository modernization from behavior changes. No implementation phase starts without project-owner approval after this analysis phase.

## Phase 0 — Baseline and decisions (current)

- [x] Import `homey-matic` with Git history and retain its MIT license.
- [x] Configure local `upstream` and `origin` remotes; do not push.
- [x] Inventory SDK, dependencies, driver layout, RPC/MQTT paths, and technical debt.
- [x] Review `aiohomematic` and `homematicip_local` structurally as MIT references.
- [x] Add contributor and architecture documentation.
- [x] Record the initial interface, hub-feature, driver, identity, TypeScript, and branch decisions.
- [x] Confirm Node.js 22 as the Homey runtime and verify the current Homey CLI with a checksummed temporary Node.js 24 toolchain.
- [ ] Confirm access to a test Homey Pro and dedicated or recorded OpenCCU environment.

Exit criterion: architecture and initial scope are approved, and local tool versions are recorded.

## Phase 1 — Reproducible SDK v3 TypeScript baseline

- [x] Change app identity and metadata to `io.github.branselbytes.openccu` / **OpenCCU for Homey**, while preserving license attribution and history.
- [x] Select Node.js 22 as the current Homey app runtime target and add strict TypeScript configuration.
- [x] Add formatter, linter, unit-test runner, and build scripts.
- [x] Generate and track a lockfile after dependency installation.
- [x] Convert the transport/settings constants as the first strict TypeScript production seam without changing their values.
- [x] Validate formatting, lint, strict type-checking, unit tests, build, and Homey publish-level manifest rules locally.
- [ ] Add the same checks to CI, but do not publish.
- [x] Record the initial product-scope and driver-strategy decisions.
- [ ] Record decisions for module format and build output policy after the first production TypeScript conversion.

Exit criterion: clean install, build, lint, type-check, unit tests, and Homey app validation run reproducibly without changing device behavior.

Known Phase 1 debt: the imported runtime dependency graph has five npm audit findings in legacy Axios, BIN-RPC, and MQTT paths. Address them by removing or replacing those paths in the typed protocol work, not with an unreviewed forced upgrade.

## Phase 2 — Typed protocol core

- [x] Define typed XML-RPC values, device/channel descriptions, paramset descriptions, events, and transport errors.
- [x] Implement XML-RPC client and callback server behind testable interfaces.
- [x] Implement bounded backoff, connection state, cancellation, and shutdown primitives.
- [x] Add an HTTP JSON-RPC 1.1 client with basic authentication, managed OpenCCU sessions, timeout, abort handling, and categorized errors.
- [x] Add HmIP-RF endpoint detection for manually configured hosts.
- [ ] Integrate UDP convenience discovery during Homey pairing while retaining manual-host fallback.
- [x] Use fake transports and redacted representative descriptions for unit/contract tests.
- [ ] Add recorded responses from a real OpenCCU after a test system is available.

Exit criterion: fixture tests cover discovery, reads, writes, push events, reconnect, malformed responses, and JSON-RPC authentication without Homey dependencies.

## Phase 3 — Domain model, metadata, and diagnostics

- [x] Build central/interface/device/channel/datapoint models.
- [x] Add a schema-versioned cache abstraction for descriptions and metadata.
- [x] Add typed event routing with listener-specific unsubscription.
- [x] Add sanitized diagnostic snapshots and bounded mapping explanations.
- [x] Represent programs and system variables in the core even though their Homey UI is deferred.
- [ ] Wire connection state and XML-RPC events into mutable runtime state during the Homey integration phase.

Exit criterion: a diagnostic run against a test OpenCCU enumerates supported and unknown datapoints with no Homey device creation required.

## Phase 4 — Mapping prototype and driver strategy decision

- [x] Extract representative mappings from legacy switch, power-meter, contact, climate, cover, and thermostat drivers.
- [x] Implement conservative generic mapping rules plus a typed profile registry for composite devices.
- [x] Resolve known products to dedicated existing drivers and unknown products to `openccu-generic`.
- [x] Add shared, tested value transforms and diagnostics for accepted/rejected mappings.
- [x] Add consistency tests ensuring every profile references an existing dedicated Homey driver.
- [ ] Validate dynamic generic capabilities, repair, restart, and presentation on a current Homey Pro.
- [x] Record the selected dedicated-driver-plus-generic-fallback topology in ADR 0002.

Exit criterion: the prototype pairs representative devices, processes live events, survives restart/reconnect, and explains every mapping decision.

## Phase 5 — First functional device slice

- Implement pairing/setup for one OpenCCU and multiple interfaces.
- Ship a narrow, explicit device matrix based on tested profiles and generic fallback rules.
- Map standard capabilities and capability-provided Flow cards first.
- Add Homematic-specific Flow triggers/actions only where standard cards are insufficient.
- Preserve unknown-device diagnostics instead of silently ignoring devices.

Exit criterion: end-to-end hardware tests pass for the agreed initial matrix, including commands, push updates, outages, restart, deletion, and re-pairing.

## Phase 6 — Hub features and coverage expansion

- Add programs and system variables to Flow/UI surfaces.
- Use OpenCCU names, rooms, and functions to improve pairing and diagnostics according to the approved naming policy.
- Port additional legacy knowledge into profiles, backed by fixtures and hardware reports.
- Add a privacy-reviewed diagnostic export suitable for issue reports.

Exit criterion: documented coverage matrix, regression fixtures, and a repeatable unsupported-device intake process.

## Phase 7 — Release readiness

- Complete security, dependency, license/attribution, privacy, and performance reviews.
- Validate upgrade behavior for this new app (not migration from the predecessor app).
- Test installation and removal on supported Homey Pro generations and supported OpenCCU versions.
- Finalize user documentation, troubleshooting, contributor workflow, and release checklist.
- Push, create repository settings, publish, or submit to the Homey App Store only after explicit approval.

## Test strategy

- Unit tests: codecs, normalization, profile matching, capability conversion, retry state machines, redaction.
- Contract tests: recorded XML-/JSON-RPC requests and responses, callback events, OpenCCU variants.
- Integration tests: dedicated OpenCCU fixture or simulator on a controlled LAN.
- Homey tests: pairing, dynamic capabilities, settings/repair, Flow cards, restart, and app shutdown.
- Hardware matrix: record device model, firmware, interface, profile, readable/writable datapoints, and event results.

Every implementation pull request should state which layers changed, list exact verification commands, and call out missing hardware coverage.
