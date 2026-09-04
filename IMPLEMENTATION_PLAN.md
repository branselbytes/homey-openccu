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

The inherited Axios, BIN-RPC, MQTT, CCU-Jack, and discovery paths have been removed. `npm audit --omit=dev` reports zero production findings.

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
- [x] Wire connection state and XML-RPC events into mutable runtime state during the Homey integration phase.
- [x] Persist schema-versioned `VALUES` paramset descriptions and invalidate affected channels on device callbacks.
- [x] Expose credential- and value-free XML-RPC queue and outcome counters for diagnostics.

Exit criterion: a diagnostic run against a test OpenCCU enumerates supported and unknown datapoints with no Homey device creation required.

## Phase 4 — Mapping prototype and driver strategy decision

- [x] Extract representative mappings from legacy switch, power-meter, contact, climate, cover, and thermostat drivers.
- [x] Implement conservative generic mapping rules plus a typed profile registry for composite devices.
- [x] Resolve known products to dedicated existing drivers and unknown products to `openccu-generic`.
- [x] Add shared, tested value transforms and diagnostics for accepted/rejected mappings.
- [x] Add consistency tests ensuring every profile references an existing dedicated Homey driver.
- [x] Validate dynamic generic capabilities, repair, restart, and presentation on a current Homey Pro.
- [x] Record the selected dedicated-driver-plus-generic-fallback topology in ADR 0002.

Exit criterion: the prototype pairs representative devices, processes live events, survives restart/reconnect, and explains every mapping decision.

## Phase 5 — First functional device slice

- [x] Add a Homey-independent HmIP-RF discovery pipeline with bounded paramset concurrency and diagnosable partial failures.
- [x] Build stable, serializable pairing candidates from discovery results and route them to dedicated drivers or the generic fallback.
- [x] Route XML-RPC callback events through a central typed runtime/event facade.
- [x] Add strict manual OpenCCU configuration parsing with credential-free diagnostic projection.
- [x] Add deterministic multi-central runtime replacement, removal, and aggregate shutdown handling.
- [x] Add a strict Homey settings adapter and serialized settings-change controller.
- [x] Replace the legacy MQTT/CCU-Jack settings page with manual HmIP-RF OpenCCU settings.
- [x] Remove the unused external Homey MQTT-app permission.
- [x] Implement callback-server readiness, per-central callback ports, background reconnect, connection states, deregistration, and shutdown.
- [x] Preserve separate profile read/write targets and add a shared dynamic-capability device controller.
- [x] Add a narrow runtime provider for driver lookup and driver-filtered pairing candidates.
- [x] Implement Homey pairing/setup over configured OpenCCUs, initially activating HmIP-RF only.
- [x] Add the `openccu-generic` Homey driver with dynamic capability reconciliation.
- [x] Switch six profiled HmIP driver families to the shared runtime.
- [x] Limit XML-RPC concurrency globally, prioritize commands, and defer device reads until discovery is healthy.
- [x] Re-resolve and persist stored bindings against the current discovery before device activation.
- [x] Match observed eTRV type suffixes and route HmIP-eTRV-B-2/E variants to the thermostat driver.
- [x] Confirm delayed writes through callbacks or bounded read-back before treating the displayed state as authoritative.
- [x] Add explicit thermostat mode, boost, and week-profile Flow actions.
- [x] Remove inactive legacy drivers, transports, API surfaces, tools, Flow cards, and runtime dependencies from the active tree.
- [x] Validate pairing, dynamic capabilities, callbacks, temperature commands, restart, and reconnect on Homey Pro with OpenCCU.
- [ ] Publish a hardware-verified initial device matrix.
- Map standard capabilities and capability-provided Flow cards first.
- Add Homematic-specific Flow triggers/actions only where standard cards are insufficient.
- Preserve unknown-device diagnostics instead of silently ignoring devices.

Exit criterion: end-to-end hardware tests pass for the agreed initial matrix, including commands, push updates, outages, restart, deletion, and re-pairing.

### Current handoff point

HmIP-RF registration, discovery, pairing, temperature commands, delayed write acknowledgement, callback updates, and restart/reconnect have been exercised on Homey Test against OpenCCU. Dedicated `HmIP-eTRV-2` pairing and activation have also been verified for HmIP-eTRV-B-2, HmIP-eTRV-E-A, and HmIP-eTRV-2 variants; a stored-binding parser regression found during that test now has automated coverage. The remaining hardware gate is validating mode, boost, week profile, valve position, deletion, and re-pairing. Redacted real responses should then become regression fixtures before coverage expands.

## Phase 6 — Hub features and coverage expansion

- [x] Establish `DEVICE_SUPPORT.md` with explicit fixture- and hardware-verification levels and pinned reference revisions.
- [x] Add the first passive-sensor driver batch: HmIP-SWDO-2, HmIP-SWO-PR, HmIP-SLO, and HmIP-STE2-PCB.
- [x] Split switch, contact, and climate families into individual product-facing drivers and correct HmIP-SRH/HmIP-STHO semantics.
- [x] Split remaining shared thermostat and cover profiles into individual product-facing Homey drivers.
- [x] Add motion, presence, acceleration, water, and smoke detector profiles with deterministic parameter fallbacks.
- [x] Add stateless button/event bindings, a shared device Flow trigger, and the first BRC2/WRC2/WRC6/RC8 remote profiles.
- [x] Add stable logical-subdevice pairing and binding support, then port HmIP-DRSI4 and HmIP-MOD-OC8 as the first multi-output actuators.
- [x] Extend the reference-backed switch matrix with FSI, FS6, USBSM, WGC, PCBS2, BS2, and WHS2 product drivers.
- [x] Add explicit dim-level on/off conversion and initial BDT, FDT, PDT, and three-output DRDI3 dimmer drivers.
- [x] Correct cover movement reads and route Homey up/down/stop commands to OpenCCU LEVEL/STOP explicitly.
- [x] Split blind semantics from covers and add LEVEL_2 slat control for FBL and BBL.
- [x] Add native lock/unlock and garage open/close mappings for DLD and MOD-HO/MOD-TM with explicit enum commands.
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
