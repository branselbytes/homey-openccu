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
- [x] Confirm access to Homey Test and the local OpenCCU environment.

Exit criterion: architecture and initial scope are approved, and local tool versions are recorded.

## Phase 1 — Reproducible SDK v3 TypeScript baseline

- [x] Change app identity to `io.github.branselbytes.openccu` and the guideline-compatible Store display name to **OpenCCU Local**, while preserving the OpenCCU for Homey project name, license attribution, and history.
- [x] Select Node.js 22 as the current Homey app runtime target and add strict TypeScript configuration.
- [x] Add formatter, linter, unit-test runner, and build scripts.
- [x] Generate and track a lockfile after dependency installation.
- [x] Convert the transport/settings constants as the first strict TypeScript production seam without changing their values.
- [x] Validate formatting, lint, strict type-checking, unit tests, build, and Homey publish-level manifest rules locally.
- [x] Add non-publishing CI for clean install, formatting, lint, types, tests, build, Homey validation, and production audit.
- [x] Record the initial product-scope and driver-strategy decisions.
- [x] Record CommonJS module format and ignored, reproducible build output policy in ADR 0009.

Exit criterion: clean install, build, lint, type-check, unit tests, and Homey app validation run reproducibly without changing device behavior.

The inherited Axios, BIN-RPC, MQTT, CCU-Jack, and discovery paths have been removed. `npm audit --omit=dev` reports zero production findings.

## Phase 2 — Typed protocol core

- [x] Define typed XML-RPC values, device/channel descriptions, paramset descriptions, events, and transport errors.
- [x] Implement XML-RPC client and callback server behind testable interfaces.
- [x] Implement bounded backoff, connection state, cancellation, and shutdown primitives.
- [x] Add an HTTP JSON-RPC 1.1 client with basic authentication, managed OpenCCU sessions, timeout, abort handling, and categorized errors.
- [x] Add HmIP-RF endpoint detection for manually configured hosts.
- [x] Add explicit UDP convenience discovery in settings before pairing while retaining manual-host fallback (ADR 0015).
- [x] Use fake transports and redacted representative descriptions for unit/contract tests.
- [ ] Add recorded responses from a real OpenCCU after a test system is available.

The eQ-3 UDP request and response layout are verified read-only against the project OpenCCU. The stored test structure uses a synthetic serial and redacted trailing fields. Broadcast discovery is intentionally same-subnet only; the current routed Homey/OpenCCU topology continues to use manual host configuration.

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
- [x] Start a hardware-verified device matrix in `DEVICE_SUPPORT.md` (expand it as more hardware becomes available).
- Map standard capabilities and capability-provided Flow cards first.
- Add Homematic-specific Flow triggers/actions only where standard cards are insufficient.
- Preserve unknown-device diagnostics instead of silently ignoring devices.

Exit criterion: end-to-end hardware tests pass for the agreed initial matrix, including commands, push updates, outages, restart, deletion, and re-pairing.

### Current handoff point

HmIP-RF registration, discovery, pairing, temperature commands, delayed write acknowledgement, callback updates, and restart/reconnect have been exercised on Homey Test against OpenCCU. Dedicated `HmIP-eTRV-2` pairing and activation have also been verified for HmIP-eTRV-B-2, HmIP-eTRV-E-A, and HmIP-eTRV-2 variants; a stored-binding parser regression found during that test now has automated coverage. The dedicated `HmIP-SWO-PR` driver has additionally been paired and verified with live initial reads and subsequent XML-RPC push updates for illuminance and wind data. The remaining thermostat hardware gate is validating mode, boost, week profile, valve position, deletion, and re-pairing. Redacted real responses should then become regression fixtures before coverage expands.

## Phase 6 — Hub features and coverage expansion

- [x] Establish `DEVICE_SUPPORT.md` with explicit fixture- and hardware-verification levels and pinned reference revisions.
- [x] Load and normalize live-tested JSON-RPC device/channel names, rooms, functions, programs, and system variables without coupling them to XML-RPC health.
- [x] Use OpenCCU device and logical-channel names for new pairing candidates while preserving user-chosen names after pairing.
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
- [x] Add SWSD intrusion-siren control and atomic default alarm commands for HmIP-ASIR.
- [x] Add basic HmIP-WSM irrigation-valve open/close control on its dedicated valve channel.
- [x] Map HmIP-WSM water flow and cumulative volume to standard Homey units.
- [x] Add HmIP-SCTH230 CO₂, temperature, humidity, and physical-relay mapping while deferring its indicator LED.
- [x] Add HmIP-BSM switching, energy measurements, and local button events.
- [x] Add individual HmIP-FSM and HmIP-FSM16 switching and energy-measurement drivers.
- [x] Add individual HmIP-FSI6 and HmIP-FSI16 switch drivers on the input-layout receiver channel.
- [x] Add HmIP-DRG-DALI logical outputs 1–48 with discovered dim, hue, and saturation capabilities; defer metadata-normalized color temperature.
- [x] Add selective profile-owned MASTER configuration reads and mode-aware HmIP-RGBW logical outputs with a safe single-dimmer fallback.
- [x] Add separate HmIP-SWO-B/PL/PR drivers with discovery-filtered wind, rain, and sunshine-duration capabilities in matching units.
- [x] Port the final three legacy HmIP product drivers: BRA button events, SCI contact, and discovery-adaptive FCI1 contact/button behavior.
- [x] Add program execution, typed system-variable writes, and refreshed equality checks to Homey Flow with dynamic autocomplete.
- [x] Add one read-only OpenCCU system device per central for connection state, device count, service-message count, duty cycle, and carrier sense.
- [x] Add a cached, privacy-reduced dashboard widget for OpenCCU connection and radio-system status.
- [x] Add a privacy-reduced dashboard widget for detailed active service messages with app-level request coalescing and caching.
- [x] Add an independently supervised VirtualDevices XML-RPC runtime and a dedicated fixture-backed `HmIP-HEATING` group driver; live pairing, commands, and callbacks remain the hardware gate.
- [x] Expose rooms and functions as read-only per-device Flow tags; never create or move Homey zones implicitly (ADR 0016).
- Port additional legacy knowledge into profiles, backed by fixtures and hardware reports.
- [x] Add a privacy-reviewed diagnostic export suitable for issue reports.

Exit criterion: documented coverage matrix, regression fixtures, and a repeatable unsupported-device intake process.

The hub Flow cards are manifest-, fixture-, and read-path verified on Homey Test. Live metadata filtering exposes 9 non-internal programs and 14 visible, non-internal system variables on the current OpenCCU. A dedicated disposable program or system variable is still required before write execution can be hardware verified without affecting production automation.

The system device uses two isolated JSON-RPC reads per minute and central. Unsupported metrics remain unknown. Live pairing, callback-backed connection state, and the current OpenCCU response shape are verified on Homey Test; Insights history and multi-interface aggregation remain hardware gates.

The service-message widget queries details only while a dashboard containing it is open. It uses one read-only ReGa script per central at most once every 30 seconds across widget instances, strips raw device addresses at the app API boundary, and renders configured names with safe DOM text nodes. Live list contents and Homey dashboard rendering remain hardware gates.

The system-status widget uses the existing typed JSON-RPC system-information path. Widget requests are deduplicated and cached for 30 seconds, and interface addresses are removed at the app API boundary. The system-status and service-message widgets use compact neutral tiles, Homey-coloured icons, light/dark themes and short refresh timestamps in the headers, matching the Gardena/Wolf widgets. Local browser checks with simulated Homey data verified narrow layouts, multiple centrals and loading/error states. Live dashboard layout and refresh behavior remain a Homey Test gate.

Widget design validation: `npm run check` passed formatting, lint, type-checks and all 286 unit tests; `npm run build` and `homey app validate --level publish` passed. Twelve local browser scenarios covered both widgets at 260, 360 and 600 px in light/dark mode, manual refresh, missing values and unavailable/empty/error responses. The light/dark preview images were regenerated from these simulated views. OpenCCU uses the shared Gardena/Wolf typography: 17 px numeric values with 23 px line height, 13 px titles/message text, 12 px status/device names and 11 px labels/timestamps. Legacy Homey text utility classes are omitted so they cannot override the widget typography. No live OpenCCU integration test was performed for this visual change. After user approval, the widget update was installed on Homey Christian and the running app state was confirmed. Installation on Homey Eltern remains pending: the remote upload returned HTTP 400, with a buffered multipart retry reporting "Unexpected end of form". Its existing app remains running; the user confirmed that the preceding widget update was visible on the dashboard. The restored shared typography requires a fresh dashboard check.

The settings page creates a sanitized JSON support report and offers native file sharing, browser download, and clipboard/manual-copy fallbacks for embedded Homey views. It contains anonymous central/device aliases, connection states, aggregate counters, device types, firmware versions, channel/datapoint definitions, and selected drivers/capabilities. Credentials, addresses, central IDs, OpenCCU object names, and current datapoint values are omitted; a final recursive redaction pass guards future diagnostic fields.

Homey command logs likewise omit concrete Homematic channel addresses and datapoint values. A clean `npm ci` confirms that the production tree contains only `homematic-xmlrpc` and its two parser/builder dependencies; previously observed MQTT, BIN-RPC, and Axios packages were untracked leftovers in the local `node_modules` directory rather than declared runtime dependencies.

The XML-RPC callback listener now rejects TCP connections whose normalized source address does not match the configured OpenCCU host. This closes straightforward LAN event injection while keeping source-NAT/proxy layouts an explicit compatibility risk rather than accepting all senders.

On the current routed Homey Test/OpenCCU network, live weather events continued after source filtering, while a valid non-mutating XML-RPC request from the development host was rejected before dispatch. Hostname, IPv6, proxy, and source-NAT layouts remain unverified.

The regular Homey Test process stabilized at 92.8–93.5 MB PSS and 0% idle CPU while XML-RPC callbacks continued. Remote debug/inspector mode crossed Homey's memory warning threshold, although the JSON-RPC payloads total only about 153 KB. Metadata responses are normalized sequentially to avoid concurrent response trees. Memory headroom, debug-mode behavior, and the static driver count remain explicit Phase 7 performance-review items.

## Phase 7 — Release readiness

- Complete security, dependency, license/attribution, privacy, and performance reviews.
- Validate upgrade behavior for this new app (not migration from the predecessor app).
- Test installation and removal on supported Homey Pro generations and supported OpenCCU versions.
- Finalize user documentation, troubleshooting, contributor workflow, and release checklist.
- Push, create repository settings, publish, or submit to the Homey App Store only after explicit approval.

Initial changelog, compatibility matrix, troubleshooting, contributor, release-checklist, and third-party-notice documents now exist. They deliberately retain open hardware, compatibility, performance, and release-approval gates rather than presenting the app as release-ready.

The release audit passed a clean locked install and was extended on 2026-09-07 through 252 passing tests, formatting, lint, strict types, build, and publish validation. The production audit remains at zero findings, runtime licenses are MIT-compatible, and the minimized package retains required license notices while excluding development documentation, configuration, and source maps. English and German settings and custom-capability labels are now consistency-tested. A beta-testing guide, public issue template, and Homey Community announcement draft are prepared. With explicit owner approval, the preserved project history was pushed to the public `branselbytes/homey-openccu` repository and Homey App Store version `0.1.0` was uploaded as Draft build 1. The owner submitted build 1 for initial certification without automatic Live publication; Athom currently reports it as under review. Test activation and the forum announcement have not occurred.

The development toolchain is pinned to the compatible patch releases Homey CLI 4.4.4 and ESLint 10.10.0. `npm audit --omit=dev` remains at zero findings. The full audit currently reports 20 transitive development-only findings through the Homey CLI; npm's proposed aggregate remedy downgrades Homey to 3.7.1 and is therefore not accepted. These findings must be reassessed when Athom publishes updated CLI dependencies, and the CLI should only process trusted app assets in the meantime.

## Test strategy

- Unit tests: codecs, normalization, profile matching, capability conversion, retry state machines, redaction.
- Contract tests: recorded XML-/JSON-RPC requests and responses, callback events, OpenCCU variants.
- Integration tests: dedicated OpenCCU fixture or simulator on a controlled LAN.
- Homey tests: pairing, dynamic capabilities, settings/repair, Flow cards, restart, and app shutdown.
- Hardware matrix: record device model, firmware, interface, profile, readable/writable datapoints, and event results.

Every implementation pull request should state which layers changed, list exact verification commands, and call out missing hardware coverage.

### Wired device support (2026-09-08)

- [x] Read HmIPW-DRS8 and HmIPW-DRI16 descriptions and current input modes from OpenCCU without writes.
- [x] Add eight logical outputs with separate physical feedback and command targets.
- [x] Add per-channel configured input modes, stable identities, and live reconciliation after updateDevice/discovery.
- [x] Add redacted recorded fixtures and tests for output commands, all input modes, and paired input mode transitions.
- [ ] Install the updated app on Homey with approval, pair outputs/inputs, and verify physical switching and Flow triggers.

Validation for this change: `npm run check` passed (formatter, ESLint, strict type checks, 255 tests in 47 files); `npm run build`, `npx homey app build`, and `npx homey app validate` passed (Homey publish validation). The read-only live probe using the compiled runtime returned eight output candidates, 16 input candidates, zero discovery issues, and 11 successful mapped state reads. No commands or callback registrations were sent. The probe also exposed and fixed configuration discovery skipping main devices with an empty PARENT string. Physical writes, button callbacks, and Homey pairing remain unverified until installation is approved.

Installation follow-up (2026-09-08): installed the updated app on **Homey Test** with explicit user approval, preserving existing app data. Homey reports the app enabled, running, and not crashed; both HmIPW-DRS8 and HmIPW-DRI16 drivers are present. Local probe credentials were not injected as app environment variables. Pairing the new channels and physical Flow/switch tests remain pending.

User acceptance follow-up (2026-09-08): the user reports that the practical DRS8/DRI16 tests work on Homey Test. DRS8 output switching was explicitly confirmed earlier; the subsequent test confirmation closes the reported pairing/test issue at user-acceptance level. Per-channel, press-variant, live mode-change, and reconnect coverage was not individually reported.

### Wired infrastructure and presence (2026-09-08)

- [x] Read descriptions of one HmIPW-DRAP, four HmIPW-SPI units, and one HmIP-BRC2 from OpenCCU.
- [x] Add a read-only DRAP diagnostic driver with distinct bus measurements and fault indicators.
- [x] Add a dedicated Wired presence/illuminance driver.
- [x] Verify the existing BRC2 profile with recorded two-button, event-only data.
- [ ] Confirm real presence changes, bus fault events, and short/long BRC2 presses on Homey Test.

Validation and deployment: `npm run check` passed (formatting, lint, strict type checks, 259 tests in 48 files). `npx homey app build` and Homey publish-level validation passed. A read-only live integration using the compiled runtime confirmed six candidates and 22 successful mapped state reads with zero discovery issues. Updated Homey Test under the existing deployment approval, preserving app data. The app reports running/enabled/not crashed; actual pairing lists return one DRAP, four Wired presence detectors, and one BRC2. No devices were created and no physical control commands were sent during this verification.

### Weather compass (2026-09-08)

- [x] Add read-only homematic_wind_direction to HmIP-SWO-PR while retaining the original degree capability.
- [x] Derive eight compass sectors with localized German/English labels.
- [x] Cover sector boundaries, invalid values, existing-device reconciliation, and degree/compass callback updates with tests.

Wind compass validation: `npm run check` passed (formatting, lint, type checks, 286 tests in 48 files); Homey build and publish validation passed. Installed on the previously approved Homey Test without clearing app data. The existing HmIP-SWO-PR remains available and automatically acquired the new localized capability. Its live 70-degree value matched enum e, displayed as German O. Synthetic callbacks cover subsequent updates; no device writes were performed.

Wind compass label follow-up: display all eight direction names in full in German and English; enum identities and angle mapping remain unchanged.

Release upload (2026-09-08): version 0.1.1 passed all 286 tests and Homey publish validation, then uploaded successfully to Athom as Build 2. The upload omitted local environment credentials and excluded recorded test fixtures from the package. No Test/Live activation was requested. The local GitHub device login was restored for the authorized origin/main push.

### Detection control

- [x] Add the localized device control “Detection active / Erkennung aktiv” for supported motion and presence profiles, conditional on a discovered writable datapoint.
- [x] Correct HmIP-SMI55 detection and illuminance to channel 3 while preserving button channels 1/2.
- [x] Cover activation/deactivation, missing/read-only datapoints, startup capability migration and CCU callbacks with fixtures, including the recorded HmIPW-SPI description.
- [ ] Verify live switching and update timing on physical motion/presence detectors.

The switch uses existing runtime write confirmation and capability reconciliation. Disabling detection leaves the last CCU motion alarm intact until the CCU reports a new alarm state. No actual detectors were toggled during automated testing.

Validation: `npm run check` passed formatting, lint, type-checks and all 301 tests, including 15 detection-control cases and the recorded Wired fixture. Production preprocessing/TypeScript build and `homey app validate --level publish` passed before installation on the previously approved Homey Christian. A read-only post-install check confirmed that the existing HmIP-SMI and HmIPW-SPI are available and expose `homematic_detection_active = true`. No real detection setting was changed; live command execution remains a hardware test. Homey Eltern remains pending because its remote upload failed in the preceding deployment.
