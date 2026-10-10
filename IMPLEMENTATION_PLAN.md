# Implementation plan

This plan records delivered work and remaining verification. Repository modernization and behavioral changes are reviewed separately; the current owner-authorized maintenance batch is summarized below. Deployment records refer to the version actually installed, not to subsequent local work.

## Phase 0 — Baseline and decisions

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
- [x] Add recorded responses from a real OpenCCU: Wired devices/infrastructure plus the 2026-10-03 PSM-2, Wired STH-A, eTRV and SWDO catalog recordings.

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

## SWDO family consolidation (2026-10-03)

- [x] Merge the SWDO, SWDO-2 and SWDO-I contact profiles and add HmIP-SWDO-A, including its uppercase model alias.
- [x] Show one localized SWDO pairing entry; retain deprecated SWDO-2/SWDO-I adapters and unchanged existing device identities/bindings (ADR 0018).
- [x] Prevent contacts already paired through legacy or generic drivers from appearing again in the shared pairing list.
- [x] Add dedicated synthetic XML-RPC fixture coverage for discovery, initial contact/battery values, callbacks and existing-device binding compatibility.
- [x] Install version 0.1.2 on Homey Christian without clearing app data and verify the existing-device upgrade.
- [x] Verify live discovery routes SWDO, SWDO-2 and SWDO-A through the shared profile.
- [x] Upload version 0.1.2 as Homey Developer Draft Build 3 with an empty build environment.
- [ ] Verify physical SWDO-A pairing, opening/closing and battery state on Homey.

The user reports stable operation without observed disconnects on the currently installed app. The owner subsequently authorized installation on Homey Christian, committing/pushing to origin/main and a Homey CLI Developer upload. Validation with Node.js 22.23.3: `npm run check` passed formatting, ESLint, strict type checks and all 317 tests in 51 files, including the synthetic SWDO integration fixture. `npm run build`, `node_modules/.bin/homey app build` and `node_modules/.bin/homey app validate --level publish` passed. Post-install verification on Homey Christian (Homey 13.5.0) confirms app 0.1.2 running/enabled/not crashed, all 13 existing devices available with preserved identities and capabilities, and a healthy CCU runtime discovering 35 devices with zero issues. The new SWDO-A is mapped to HMIP-SWDO with alarm_contact and alarm_battery. Physical SWDO-A pairing and events remain the hardware gate. Homey CLI upload succeeded as [Draft Build 3](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/3), with zero environment keys and no Test/Live activation.

## Project maintenance audit (2026-10-03, 0.1.8 beta)

- [x] Inventory tracked assets and obsolete build settings. All 98 pre-existing PNG/SVG assets (about 1.67 MB) remain referenced or required by Homey conventions; keep legacy adapters, recorded fixtures, license notices and history.
- [x] Remove absent legacy-directory/JavaScript build paths and unnecessary production Vitest globals; exclude generated coverage from app packages.
- [x] Consolidate the eTRV family behind the existing HmIP-eTRV-2 pairing entry, retaining old drivers and binding identities (ADR 0019).
- [x] Add the observed HmIP-PSM-2 and HmIPW-STH-A using redacted recorded descriptions, plus their manufacturer-documented color variants. Reuse existing shared bindings and preserve previously exposed generic capabilities.
- [x] Fix new/delete inventory callbacks, initial/reconnect registration handling, optional description-cache failures and normalized profile collision checks.
- [x] Record real descriptions for three SWDO and three eTRV variants; retain explicit separation between recorded metadata and simulated values/commands.
- [ ] Add complete Wired STH mode (0–3) and week-profile (1–6) mappings before exposing these controls. Existing radiator enums stay unchanged.
- [ ] Verify physical PSM-2 switching and Wired STH commands on hardware after installing the maintenance batch.
- [ ] Verify an actual CCU add/remove event and the eTRV family upgrade after installation.
- [ ] In a separate formatting-only change, include src in the formatter scripts and normalize the remaining existing source formatting. Avoid mixing that broad mechanical change into device support.

Further functional backlog remains: the second STE2-PCB probe, metadata-normalized color temperature, enhanced cover/garage/lock actions and the already listed physical button/presence/reconnect checks. Similar names alone do not justify combining profiles: SWO pro has an additional compass mapping, FCI1 includes button events, and actuators can have different feedback/command channels. HAP, RFUSB and RCV-50 currently expose no mapped application capability and remain generic infrastructure entries rather than receiving empty dedicated drivers.

The installed 0.1.2 baseline was inspected read-only and remains running. No new deployment, remote push, device creation or physical control command was performed for this maintenance batch. Read-only integration resolved eight recorded model types and successfully read 25 mapped values across six reachable types. The sampled HmIP-PSM-2 and HMIP-SWDO reported UNREACH, so their current values could not be checked. Physical commands and callbacks remain unverified for this batch. Validation with Node.js 22.23.3: `npm run check` passed formatting, ESLint, production/test type checks and all 370 tests in 55 files. The four changed source files also passed an explicit Prettier check. `npm run build`, `node_modules/.bin/homey app build`, and `node_modules/.bin/homey app validate --level publish` passed. `npm audit --omit=dev --json` reported zero production vulnerabilities. The Homey package excludes tests, recorded fixtures, documentation, coverage and test configuration; license notices remain included.

PayPal metadata follow-up: added the owner-provided PayPal.Me username `branselbytes` to `contributing.donate.paypal` in the compose manifest and regenerated app.json. Homey publish-level validation (including TypeScript compilation), manifest consistency and formatting checks passed. This metadata-only change does not affect runtime behavior; unit/lint and live CCU tests were not repeated. The donation entry is prepared locally for the next publication.

## Socket family and artwork follow-up (0.1.8 beta)

- [x] Combine PS and PSM new pairing while keeping PS/PSM/PSM-2 channel mappings, legacy PS devices and existing identities unchanged.
- [x] Identify incorrect image sharing: 78 drivers reused six product PNG pairs. Restore 39 exact-model pairs from the imported MIT history.
- [x] Accept owner-approved original schematic drawings for known devices without imported artwork (ADR 0020).
- [x] Complete local artwork, family-icon and quality-gate verification.
- [ ] Verify the Homey catalog, new family pairing icons and existing-device rendering after an authorized update.

The donation entry and preceding maintenance work remain included. No installation, remote push or publication is part of this follow-up. No physical commands are required for the artwork change.

Verification: `npm run check` passed formatting, lint, strict type checks and 409 tests in 58 files, including socket binding/event/command regression tests, recorded PSM-2 metadata, pairing icon selection and per-driver PNG path/dimension checks. `npm run build`, `node_modules/.bin/homey app build` and `node_modules/.bin/homey app validate --level publish` passed. Changed TypeScript sources passed an explicit Prettier check. The artwork generator passed `node --check` and standalone ESLint (`--no-config-lookup`, no-undef/no-unused-vars with Node Buffer/URL globals); regeneration was checked for reproducibility. Original artwork was compared with the imported ancestor, and overview images plus final family drawings were inspected visually.

Final artwork inventory: 45 imported product image pairs, 32 original schematic pairs, one neutral generic pair and 13 model SVGs for family pairing. Homey's package file selection includes all 156 driver PNGs, all 13 family SVGs and the MIT license, and excludes the generator, tests, docs, coverage and env.json. Actual Homey rendering and cached/stored icon behavior remain the post-update check; no new live hardware test was performed in this follow-up.

## App branding (2026-10-03, 0.1.8 beta)

- [x] Adopt the owner-selected second concept with a branselbytes bb circuit icon and navy/copper smart-home scene (ADR 0021).
- [x] Prepare native SVG artwork and three App Store image sizes; retain source imagery and prompts outside the app package.
- [x] Complete local visual review, quality checks and Homey publish-level validation.

This is an app-presentation change. Installation, remote push and publication have not been performed for this branding update.

Validation: the transparent SVG was reviewed at 24/32/64 px; the smallest 250 × 175 scene remains recognizable. All three PNGs decode with the required dimensions and are fully opaque. `npm run check` passed formatting, ESLint, both TypeScript checks and 409 tests in 58 files, including the recorded CCU fixtures. `homey app build` and `homey app validate --level publish` passed; the generated manifest was then normalized with Prettier. The four packaged branding assets match their build copies, and design sources/prompts are excluded from the Homey package. No new hardware integration test was run for this presentation-only change.

## Version 0.1.3 preparation (2026-10-03)

The owner authorized the next update and its GitHub/Homey Developer upload. Compose/generated manifests, package/lockfile versions and German/English Homey changelogs are aligned at 0.1.3. This version collects the maintenance, socket/artwork, donation and selected app-branding changes above; the changelog distinguishes the prepared version from publication.

The release check passed formatting, ESLint, strict production/test type checks and all 409 tests in 58 files, including the recorded CCU fixtures. TypeScript build, Homey build and publish-level validation passed; the production audit has zero reported vulnerabilities. The package contains the intended device/brand assets and license notices, excludes development/design/test data and env.json, and has no local private configuration values. Independent review found no blocking code or fixture issue. Outstanding physical-device and upgrade checks remain listed above.

Delivery: committed as [86fff77](https://github.com/branselbytes/homey-openccu/commit/86fff77) and pushed to origin/main. Homey CLI uploaded [Developer Build 4](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/4); the Developer API confirms version 0.1.3 in draft state with zero environment keys. The final archive contains 577 files and is 7.31 MB. No physical Homey installation, Test/Live activation, Git tag or GitHub release was performed for this update.

## Version 0.1.3 installation (2026-10-03)

The owner subsequently reported that 0.1.3 was released to Test and explicitly requested installation on Homey Christian and Homey Eltern. Exact-name/ID matching excluded the separate older Eltern Homey Pro. The App Store installation API installed exact version 0.1.3 with channel `test` on both, retaining app data and avoiding the previously failing remote CLI multipart upload.

Post-install read-only checks confirm both apps running/enabled/not crashed on Homey 13.5.0. Christian upgraded from 0.1.2, preserving all 17 paired app devices; Eltern upgraded from 0.1.1, preserving all six. Every existing device ID, driver assignment and capability was retained, and all devices are available. Both CCU connections are healthy with zero discovery issues (35 discovered devices on Christian, 20 on Eltern). Both installations report App Store origin, Test channel and automatic updates enabled; Christian previously had CLI origin. No physical device commands, deletion or re-pairing occurred.

The previously passed 409-test release suite applies unchanged: only deployment evidence was edited after installation, and its formatting was checked. PSM/eTRV-family upgrade testing remains open because neither paired inventory contains those families. Actual Homey UI artwork rendering and physical PSM-2/STH commands, contact/button events and CCU add/remove notifications still require separate verification.

## App Store description localization (2026-10-03, 0.1.8 beta)

- [x] Replace the English-only Store text with matching English `README.txt` and German `README.de.txt`, using two plain-text paragraphs without Markdown or URLs as required by the [Homey App Store guidelines](https://apps.developer.homey.app/app-store/guidelines).
- [x] Describe the independent homey-matic fork, supported wireless/selected Wired devices and heating groups, Flows/widgets, setup requirements, beta status and the need to pair devices again when moving from the predecessor app.
- [x] Explain the generic fallback and its limits in both languages, and add the matching German name to the generic driver manifest.
- [x] Confirm the existing app name, short description, tags, widgets and version 0.1.3 changelog already provide English and German text. Original contributor credits remain in the app manifest and license documentation.
- [x] Complete the local quality gate and verify the generated manifest and both packaged Store descriptions.

These text-only changes are prepared locally for a future authorized upload. They do not change runtime behavior or device identities. Architecture remains unchanged. A direct read-only HTTP check of the public English and German Test pages confirmed that both still display the previous English description; the German page explicitly marks the visible summary as `lang="en"`.

Validation with Node.js 22.23.3: `npm run check` passed formatting, ESLint, strict production/test type checks and all 409 tests in 58 files, including recorded CCU fixtures. `npm run build`, `node_modules/.bin/homey app build` and `node_modules/.bin/homey app validate --level publish` passed. The regenerated app manifest differs only in the generic driver's German name. Both Store descriptions contain two plain-text paragraphs and match their packaged `.homeybuild` copies; the generated and packaged manifests are semantically identical. `git diff --check` passed. No new live CCU or hardware integration test was run for this text-only change, and no upload, push or publication was performed.

## App Store Flow catalog and widget review (2026-10-03, 0.1.8 beta)

- [x] Read the public English and German Test listings and compare their Flow cards with the local manifest: all seven custom cards are present and translated, but only two automatic DRAP cards are shown because almost all driver capability lists are empty.
- [x] Review official Homey widget/style/Store documentation. Replace custom 11–13px text and 12px outer padding with native size/spacing tokens, responsive layouts and semantic icon colors.
- [x] Replace all four screenshot previews with original, transparent, text-free 1024 × 1024 artwork, generated reproducibly with the existing development-only renderer.
- [x] Resolve widget translations through Homey's selected language and correct refresh overlap, polling flicker and misleading unavailable system status.
- [x] Confirm both widgets appear in the public English/German Test listings with localized names; their published previews match the previous 360px screenshots. New local previews require a future authorized upload.
- [x] Finish conservative driver/Flow metadata checks, regenerate the manifest, and run the complete quality gate.
- [x] Complete final browser checks for both languages, themes, narrow layouts and error/empty/partial states.
- [ ] Verify the resulting catalog and widgets in the App Store and on a physical Homey after a separately authorized upload/installation.

ADR 0022 records the static catalog baseline and its separation from live discovered capabilities. Existing device identities, control bindings, Flow IDs and transport behavior are preserved. No push, upload, installation or publication is part of this review.

The Store baseline deliberately omits capabilities requiring a newer Homey than the existing 12.9.0 minimum, optional controls, configuration-dependent inputs and battery capabilities without verified model/family battery metadata. Homey requires battery type/count metadata when battery capabilities are declared statically; this review does not invent those values. The normal discovery path still supplies the full supported feature set to each paired device. Device-owned custom Flow cards use the device's context rather than repeating a reserved `[[device]]` token in their formatted title.

Final scope: 60 driver capability manifests changed, four custom device-card filters/titles corrected, two widget views localized/restyled and four preview images replaced. The generated manifest retains all 78 driver IDs and seven Flow IDs, app version 0.1.3 and minimum Homey 12.9.0. Generic, deprecated, event-only and configuration-dependent entries may correctly have no static capabilities.

Validation with Node.js 22.23.3: `npm run check` passed formatting, ESLint, production/test type checks and all 435 tests in 61 files, including recorded OpenCCU fixtures. `npm run build`, `node_modules/.bin/homey app build` and `node_modules/.bin/homey app validate --level publish` passed. The generator passed `node --check scripts/generate-widget-previews.mjs`, standalone ESLint with Node Buffer/URL globals and byte-for-byte regeneration. All four previews are 1024px RGBA images with transparent corners; packaged images, HTML, locales and both Store descriptions match the source files. The generator remains excluded from the app package, and the generated/build manifests are semantically identical. `git diff --check` passed.

Local Playwright/Brave checks with synthetic data passed 32 combinations of both widget views, German/English, light/dark and widths 240/320/360/768px, plus 20 cases for empty/error/unavailable/partial/offline states, multiple centrals and long lists at 240/360px. No horizontal overflow or system-widget clipping was observed; screenshots were visually reviewed. The harness supplies a system font and documented styling fallbacks rather than running inside a connected Homey webview. No live CCU command, physical-device integration test, Homey installation or post-upload Store verification was performed. Final Store rendering and a real Homey upgrade remain the explicitly open follow-up above.

## HmIP-MOD-HO and support-report issue #1 (2026-10-03, 0.1.8 beta)

- [x] Compare the manufacturer's functions, issue #1 and forum screenshots/report with the imported driver and pinned `aiohomematic`/`homematicip_local` references; record attribution and decisions in ADR 0023.
- [x] Preserve a minimal anonymized firmware 1.0.16 description and verify existing light channel/boolean and garage string-command routing.
- [x] Reproduce and fix valid unknown positions aborting callback batches, including subsequent light updates.
- [x] Add native open/stop/close, ventilation and four-state position controls, retaining existing device identities and capabilities; add English/German Flow actions and position condition.
- [x] Await actual acknowledgements for write-only commands, propagate delayed rejections, and skip their state read-back verification without adding motor command retries.
- [x] Preserve safe CCU fault codes and latest failed method/category, excluding raw remote error text and arguments.
- [x] Keep the complete JSON export and add a bounded model-focused forum summary plus share/clipboard fallbacks and localized instructions.
- [x] Complete the combined formatter/lint/type/unit/build/Homey validation and browser checks.
- [ ] On the affected HmIP-MOD-HO hardware, test native Homey controls and actual opening/stopping/closing/ventilation/light operation; obtain a new fault code if writes are still rejected. Version 0.1.4 is installed on Homey Christian, but this does not verify the reporter's module.

The submitted JSON is valid; its 68,203-byte size and forum attachment restrictions caused the sharing difficulty. The short overview is about 1 KB and the HmIP-MOD-HO summary about 1.9 KB. The specific outgoing `setValue` rejection remains unexplained by the available report, which contains neither live values nor a CCU fault code. The callback bug is confirmed independently; its repair does not prove that both physical write failures are resolved. No deployment, push, publication, issue reply or physical device command is included in this work.

Final validation with Node.js 22.23.3: `npm run check` passed formatter, ESLint, production/test type checks and all **535 tests in 65 files**, including the anonymized Hörmann metadata with synthetic read/write/callback integration. `npm run build`, `node_modules/.bin/homey app build` and `node_modules/.bin/homey app validate --level publish` passed. Changed TypeScript source files also passed an explicit `prettier --check` because the repository format script does not cover `src`. `git diff --check` passed. No dedicated physical fixture is available for this module.

The generated and packaged manifests are semantically identical: all 78 driver IDs and the previous seven custom Flow IDs remain, with three new garage cards and the five-capability Hörmann profile. App version remains 0.1.3; changes are 0.1.8 beta. Packaged settings, locales, icons and Store descriptions match source; compiled garage/error modules are included and the diagnostic fixture is excluded. Flow dropdown IDs match the corresponding capability enums.

Local Playwright/Brave diagnostics checks passed 52 assertions using synthetic data in German/English at 320/768px: overview/model summaries, safe failure details, successful sharing, rejected sharing with complete JSON download, share cancellation without download, clipboard/manual-copy fallbacks, and no page errors or horizontal overflow. The harness uses a mock Homey bridge; actual native Homey rendering and physical commands remain the separate open validation step above.

## Device artwork refinement (2026-10-03, 0.1.8 beta)

- [x] Recheck primary OpenCCU, manufacturer OpenCCU-Base/OCCU and `openccu-data` terms with pinned references. Distinguish conditional HMSL manufacturer-image reuse from OpenCCU's own graphics restrictions; document the independent-SVG decision in ADR 0024.
- [x] Inventory and preserve the 45 inherited driver illustrations and neutral generic fallback; snapshot the 32 generated drawings for comparison.
- [x] Redraw all 32 project-authored driver icons plus PSM-2 and SWDO-A family icons, with 960px transparent SVGs, consistent margins, finer perspective contours and corrected physical forms.
- [x] Synchronize the three generated family copies and render matching 75/500px white-background PNGs. Preserve existing manifests, pairing paths, device identities and capabilities.
- [x] Keep generation reproducible through electrical, household and sensor source modules, with form-reference URLs and no new dependency or runtime network access.
- [x] Complete the final visual, reproducibility, asset/package and repository quality checks.
- [ ] Inspect actual Homey rendering/cache after a separately authorized installation.

Manufacturer photos were consulted only for product form and remain outside the repository. The app includes only the inherited assets and newly authored drawings. A before/after preview of eight representative devices is recorded in `docs/design/device-artwork-comparison.png`, excluded from the Homey package. This artwork work does not install, publish or issue physical device commands.

Validation with Node.js 22.23.3: `npm run check` passed formatting, ESLint, production/test type checks and all **535 tests in 65 files**, including existing recorded/synthetic device fixtures. `npm run build`, `node_modules/.bin/homey app build` and `node_modules/.bin/homey app validate --level publish` passed. All four artwork modules passed `node --check` and standalone ESLint with the Node Buffer/URL globals; `git diff --check` passed. No new behavior tests were needed for geometry-only changes.

All **101 generated files** (32 driver SVGs, 64 PNGs, two additional family SVGs and three family copies) reproduce byte-for-byte and match their packaged counterparts. All 45 inherited driver asset sets and the generic set match their original bytes. Generated/package manifests remain semantically identical; generator modules, test fixtures and design previews are excluded from the app package. Independent rendering checks cover all 34 distinct geometries, their transparent bounds within 48–911px, three matching family copies, and 40/75px views on light/dark backgrounds. No clipping or opaque background rectangles were found. The eight-device comparison and full contact sheets were visually reviewed. Actual Homey UI/cache verification remains open above; no physical-device command was needed or performed for this asset-only change.

## Version 0.1.4 delivery (2026-10-03)

- [x] Align compose/generated manifests, package/lockfile versions and English/German release notes at 0.1.4, collecting the Store/Flow, widget, Hörmann/diagnostics and artwork work above.
- [x] Pass formatter, lint, strict production/test types, all 535 tests in 65 files, TypeScript build, Homey build and publish-level validation.
- [x] Install the complete production package on Homey Christian without clearing app data; verify running state, healthy CCU transport and all 17 existing devices with preserved IDs, drivers and capabilities.
- [x] Upload [Homey Developer Draft Build 5](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/5), confirm zero environment keys and exact English/German description/changelog matches.
- [ ] Verify physical Hörmann operation on the affected module and actual Homey widget/icon rendering. Public Store verification follows a separately authorized Test/Live activation.

The final package contains 582 files (7.26 MB), including all production dependencies and license notices. The direct Cloud multipart route returned HTTP 400, so installation used the local connection. The first local package crashed because a preceding standalone Homey validation had recreated `.homeybuild` without runtime dependencies. Full preprocessing, in-place publish validation and reinstalling the corrected package resolved the failure; the release checklist now explicitly guards this ordering trap. Read-only checks after repair confirm version 0.1.4 running/enabled/not crashed on Homey 13.5.0, 17/17 available devices, healthy discovery of 35 CCU devices and zero reported transport/discovery/metadata/system-information failures. Automatic updates remain enabled; installation origin is `devkit_install`.

Developer verification confirms Draft Build 5 contains both widgets and ten custom Flow cards. This delivery did not activate Test/Live, push Git changes, create a tag/GitHub release or send physical actuator commands. The confirmed callback fix and successful deployment do not establish that the originally reported Hörmann `setValue` rejection is resolved; that remains the explicit hardware check above.

The remote Store projection matches all 70 non-deprecated local drivers and their capabilities; the eight deprecated adapters remain in the installed manifest for existing devices. All three new Hörmann Flow IDs are present. Isolated production-dependency imports and an XML parser smoke test passed, and final read-only verification after upload again reports all 17 devices available with the app running. Final formatting and diff checks passed.

## Heating schedule editor (2026-10-04, 0.1.8 beta)

- [x] Implement the shared German/English weekly editor in app settings and thirteen thermostat/group/generic driver repair views (ADR 0025).
- [x] Read metadata-defined stored profiles independently of active-profile selection; edit existing slots, copy days/profiles as drafts, and explicitly review/confirm saves.
- [x] Restrict requests to paired/discovered targets and separate Homey adapters, schedule domain and XML-RPC transport. Validate types/rights/bounds, detect stale revisions, lock concurrent writes, preserve untouched settings/days, await acknowledgement and distinguish confirmed/pending read-back without retries.
- [x] Cover recorded three-/six-profile schemas, cross-interface routing and synthetic delayed/failed acknowledgements with automated tests. Check both UI entries through a synthetic Homey bridge in a real browser.
- [x] Assess additional MASTER settings without adding a general configuration editor or issuing device writes.
- [ ] Verify the actual Homey settings/repair host and save/read-back on a dedicated thermostat or group during a requested rollout. The implementation does not claim delivery to physical devices from CCU acknowledgement alone.

Read-only metadata checks found suitable boolean, numeric and enum parameters, including eTRV temperature offset and decalcification weekday, SWDO event-delay value/unit, SMI status-LED disable/brightness filter and Wired DRS8 display contrast/power-up state. Native Homey settings schemas are static per driver; curated, translated parameters can use them, whereas firmware-dependent generic parameters would need a custom view. A later implementation must validate the device/channel and live rights/ranges, distinguish units and inverse boolean meanings, and avoid exposing every writable MASTER field indiscriminately. No such settings editor is included in this change.

The compiled schedule service also passed read-only integration against the configured OpenCCU: eTRV-B-2 R4M (three stored/three selectable profiles), STH (six/six) and HmIP-HEATING through VirtualDevices (six/three), each with seven days and thirteen metadata-defined intervals. The harness exposed only list/description/read methods and a rejecting write stub; no schedule was changed, and only model/count results were retained. This verifies real schedule parsing, not physical write delivery.

Final verification with Node.js 26.8.1: `npm run check` passed Prettier, ESLint, application/test type checks and **627 tests in 70 files**. Explicit formatting of the other touched TypeScript source files and recommended-rule lint/syntax checks of `scripts/sync-heating-editor-assets.mjs` passed. Homey CLI `App.preprocess()` (including `npm run build`) and in-place `_validate({ level: 'publish' })` passed with production dependencies retained. The sandbox blocked compiler subprocesses, so these local checks ran with the required subprocess access. No installation, publication or version bump was performed.

The real-browser synthetic-bridge run passed **297 assertions** across both entry points, German/English, 320/768px and light/dark themes, including copying, add/remove, dirty drafts, confirmation/cancellation, pending/conflict errors, safe unsupported-device feedback, relative asset loading and no horizontal overflow. Sixteen screenshots were captured; representative narrow/light and wide/dark views were inspected. Repair views use Homey Compose's local asset mechanism with a source-drift test. The package retains all 78 drivers and includes thirteen repair views with matching editor files, backend modules, locales and runtime dependencies; credentials, fixtures and development scripts are excluded. Actual native Homey rendering and physical save delivery remain the open rollout checks above.

Installation follow-up (2026-10-04): the owner explicitly requested the current working tree on Homey Christian. The complete package (628 files, 7.69 MB) was revalidated in place and installed over the local connection with `clean: false`, `debug: false` and an empty environment. The development version remains 0.1.4. Post-install checks confirm running/enabled/not crashed, all 17 devices available with preserved identities, driver assignments and existing capabilities, and healthy CCU discovery of 35 devices with zero discovery, metadata, system-information, RPC or timeout failures. The newly installed Homey API lists the paired heating group and successfully reads its seven-day schedules: six stored profiles, three selectable profiles and writable metadata. No profile was saved or physical command sent. This verifies installation and the live Homey-to-CCU read path; native editor interaction and physical write delivery remain separate checks. No Developer upload, Store activation or Git push was performed.

## Memory warning and startup stabilization (2026-10-04)

- [x] Investigate the reported crash while opening/reloading heating profiles using read-only Homey usage measurements and bounded warning diagnostics, without an inspector.
- [x] Reduce repeated profile XML allocations with a four-entry/five-minute compiled-schema cache, four-target read admission, request coalescing and sequential large responses. Continue fresh metadata/value validation before every save and read-back.
- [x] Replace production description-cache persistence through Homey settings with one shared process-local LRU cache (512 entries/2 MiB UTF-8 key/value payload). Preserve callbacks, invalidation and fresh discovery; leave existing connection settings, devices and legacy cache keys untouched.
- [x] Record the revised cache architecture in ADR 0026 and the partial supersession of ADR 0004.
- [x] Pass formatting, ESLint, application/test type checks and all **657 tests in 72 files**, including 71 heating service tests and 14 new storage tests, plus full production preprocessing and in-place Homey publish validation.

The profile-only optimization reduced the local XML benchmark's peak RSS from about 155 to 86 MiB across 61 reads, but did not resolve live startup warnings. Instrumentation reproduced warnings before any profile read with both service versions: approximately 129–156 MB PSS, warnings every ten seconds and restarts near the fifth warning. The measured installation held 273 persisted description keys (251 kB) and issued 368 startup RPCs. The cache adapter translated inventory invalidation/repopulation into hundreds of Homey settings mutations; removing this disposable-data persistence is the isolated startup correction.

The corrected package contains 630 files (7.7 MB), retains production dependencies and excludes environment files, fixtures and development tooling. It was installed on Homey Christian with preserved app data, empty environment and debug disabled. Initial live comparison: 34–38 MB PSS during startup, around 43 MB after the cold six-profile read, and 43–46 MB after ten refreshes and eight simultaneous read requests, with zero warning events. All 17 devices remain available with preserved IDs/drivers/capabilities; discovery reports 35 CCU devices and no transport, metadata or system-information failures. No heating schedule was changed. Process heap fields are unavailable through this Homey runtime's process API and are omitted; PSS is measured externally through Homey's usage API.

The continuous live run reached 396 seconds of app uptime without a warning or restart. A read after the five-minute schema expiry also succeeded; the maximum sampled PSS was 48.7 MB. This demonstrates the improvement for the reproduced startup and profile-refresh workload, without claiming a long-term memory bound for the whole app.

A deliberate second app restart followed by another cold profile read remained at 34.4–44.0 MB PSS through 82 seconds, again with zero warnings and no unintended restart. Final checks confirm all 17 devices available and preserved, healthy CCU transport and six readable weekly profiles. The development version is still 0.1.4; no Developer upload, Store activation or physical schedule write was performed. Independent review found no lifecycle or privacy blocker in the bounded diagnostics integration.

## Compact heating editor (2026-10-04)

- [x] Replace the weekday dropdown with a compact, localized button group and visible/accessible indicators for unsaved days. Preserve drafts when switching days without additional API requests.
- [x] Use common column headings and single-row interval controls, including 42px remove buttons with full accessible labels on narrow screens. Reduce repeated labels, paragraph spacing and duplicate device information.
- [x] Collapse schedule guidance and copying tools into native expandable sections. Keep the active profile, status/errors, pending writes and explicit save confirmation visible.
- [x] Synchronize settings and all thirteen repair views from shared sources; retain Homey colors and responsive larger-text wrapping.
- [x] Pass formatting, ESLint, application/test types and all **658 tests in 72 files**, plus full production preprocessing and in-place Homey publish validation.

The synthetic-bridge browser check passed **437 assertions**, including German/English, settings/repair, 320/768px, light/dark, thirteen-interval days, enlarged text, draft preservation, copying, confirmation/cancellation, pending/conflict/error handling and no horizontal overflow. Representative screenshots were visually inspected. In the same three-interval fixture, the 320px settings editor shrank from 1,745 to 803px (54%) and repair from 1,662 to 777px (53%), with help/copy sections initially collapsed. These are local browser comparisons, not measurements of the native Homey host. No transport, schedule-write logic or app-memory behavior was changed.

The revised development package (630 files, 7.76 MB, version 0.1.4) was installed on Homey Christian with preserved app data and an empty environment. All 17 devices remain available with unchanged identities, drivers and capabilities; discovery is healthy with 35 CCU devices and no reported failures. The paired group's six stored profiles remain readable. Post-install observation through 115 seconds uptime recorded 47.1–48.1 MB PSS, zero memory warnings and no restart. No heating schedule was written and no Developer/Store release was uploaded.

## Version 0.1.5 preparation (2026-10-04)

The owner requested committing the current work, preparing the next version, transferring it to Homey Developer and installing it on Homey Eltern. Compose/generated manifests, package/lockfile and English/German release notes are aligned at 0.1.5. Both Store descriptions now include heating schedule editing and distinguish editing from active-profile selection. The release collects the heating editor, compact UI and memory corrections described above; the general two-request XML-RPC limit and priority queue predate this release.

Release validation passed formatting, ESLint, application/test TypeScript checks, all **658 tests in 72 files**, full production preprocessing and in-place Homey publish validation. Recorded/synthetic heating fixtures and the prior **437-assertion** browser check remain applicable; version metadata and Store copy do not alter editor behavior. Before installation, Christian reports 17 available devices and Eltern six, both on 0.1.4 with healthy CCU connections. Eltern's old runtime has five historical RPC timeouts; preserve this baseline when interpreting post-upgrade diagnostics. Deployment uses an empty environment and preserves app data. No public Test/Live activation or origin/upstream push is included in this authorization.

Source commit `0776a49` contains the complete 0.1.5 update. [Homey Developer Build 6](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/6) uploaded successfully as a draft. Read-only verification confirms version 0.1.5, zero environment keys, exact English/German Store description and changelog matches, two widgets, ten custom Flow cards and 70 non-deprecated Store drivers. The package contains 630 files (7.76 MB), all required runtime dependencies, and no local configuration values or development fixtures. Homey Christian is installed at 0.1.5 with all 17 devices preserved/available, healthy CCU transport, six readable profiles and zero memory warnings; a check at 140 seconds uptime measured 40.0 MB PSS before the profile read.

Homey Eltern remains at 0.1.4 pending a separately authorized Test-channel promotion or a reachable local installation path. Cloud multipart uploads fail with HTTP 400 / `Unexpected end of form`, including fixed-length streams and fully buffered forms. No forwarded URL is configured and local-only discovery is unreachable from this host. Requesting exact version 0.1.5 through the ordinary Store installer returns `build_not_found` while Build 6 is a draft. No failed attempt cleared app data or sent physical commands. The completed build is ready for a concrete publication decision; no Test/Live promotion has yet been performed.

Publication follow-up (2026-10-04): the owner explicitly authorized Test publication and the Eltern update. Build 6 was promoted to `test`; subsequent Developer verification confirms the exact 0.1.5 content and empty environment. The Store installer successfully completed the exact 0.1.5 Test installation on Homey Eltern, resolving the preceding Cloud multipart limitation. No Live publication, Git push or physical heating command was performed.

Post-install verification initially found Eltern running but still discovering the CCU, with all six Homey identities preserved and temporarily unavailable. UDP discovery confirmed the configured CCU was reachable. Discovery completed without intervention; separate checks at 340 and 387 seconds uptime confirmed all six devices available and healthy discovery of 20 CCU devices. Five `getParamsetDescription` timeouts occurred during startup and did not increase between the healthy checks; the queue was empty. Memory warnings and unintended restarts remained zero, with 72.0 MB PSS at the second healthy check. No heating devices/groups are paired on Eltern, so a live profile read is not applicable there. Christian was also rechecked at 0.1.5 with 17/17 available devices, healthy discovery of 35 CCU devices, six readable profiles and zero memory warnings. Both requested installations and the authorized Test publication are complete.

The final fresh Eltern check at 406 seconds confirms 6/6 available and preserved, 72.2 MB PSS and zero memory warnings. It retains two nonfatal discovery issues and five startup RPC timeouts; metadata issues are zero. The support report exposes only the discovery-issue count, so the affected descriptors were not identified remotely. Installation success and paired-device availability do not imply completely issue-free discovery of every CCU channel.

## Hörmann light button and isolated UI demo (2026-10-04)

The owner requested an additional light button inside the existing garage device, explicitly excluding a second lamp device. ADR 0027 preserves native controls and Flow cards while adding a stateful button in Homey's button view.

- [x] Add the light button and localized door/light titles without changing the pairing identity.
- [x] Synchronize exact light aliases through callbacks and read-back, including overlapping commands.
- [x] Complete the development-only demo generator using the recorded Hörmann fixture and production driver/runtime; see [the demo guide](docs/GARAGE_DEMO.md).
- [x] Run formatter, lint, type checks, unit/recorded-fixture tests, build and Homey validation for the production and demo apps.
- [x] Install the isolated demo on the owner-selected Homey Christian, pair one simulated garage, and verify light state plus native light Flow actions.
- [x] Have the owner inspect and accept the revised native device UI and named Flow cards in the isolated demo.
- [ ] Verify physical HmIP-MOD-HO behavior separately; a simulation cannot establish it.

Validation: `npm run check` passed (Prettier, ESLint, application/test TypeScript and **675 tests in 73 files**), including 36 recorded Hörmann integration tests and four isolated demo tests. `npm run build` and Homey publish-level validation passed for production. The generated demo passed its own type check, Homey build, publish validation and a compiled-runtime smoke test. Its final complete package was rebuilt using `App.preprocess()` and validated in place with `App._validate({ level: "publish" })`, retaining runtime dependencies and the anonymized fixture. No live CCU mutation, physical motor/light command, Git push or publication was performed. Native UI layout and main-tile quick-action selection still require visual review on Homey.

Installation follow-up: after the owner selected **Homey Christian** and completed Athom authentication, the separate `io.github.branselbytes.openccu-demo` app was installed with no environment configuration or data clearing. The complete package contains 153 files (2.72 MB). One **Garagentor (Simulation)** device was paired in the existing **Home** zone; it is ready and available with all six capabilities. Live checks verified the light button and native `on`/`off` Flow actions, including synchronized native/button states. The demo was left with its door closed and light off. The demo and production apps are running, enabled and not crashed. Production remains at 0.1.5 with all 17 device identities preserved and 17/17 available. No actual CCU device or physical actuator was changed.

UI/Flow follow-up: the owner requested the light only as a button and unambiguous Flow targets. The dedicated driver's native `onoff` remains present for existing Flows but uses `uiComponent: null`, including an in-place options migration. Live Homey 13.5.1 metadata confirms that the toggle view contains only `garagedoor_closed`, while the button view contains ventilation and light. Older supported firmware has not been checked. Added three explicitly named light actions, an invertible light condition, two light triggers and a garage-position trigger; the existing ventilation/position cards now identify the garage door in their formatted titles too. Homey's generic native card names remain available for compatibility.

The updated demo was installed in place without re-pairing. Direct live checks confirmed all native Flow IDs, every new localized title, both native and named light actions, the light button, toggling and light/position conditions. Light commands did not move the simulated door; open/close/ventilation commands did not change the light. Three temporary simulation-only Flows verified actual SDK dispatch for light-on, light-off and position-change triggers and were removed after testing. The simulation was left closed/light-off. Production remains at 0.1.5 with all 17 existing devices preserved and available; no real actuator was commanded.

Final checks passed: `npm run check` (**698 tests in 73 files**, formatter, lint and both type checks), production/demo TypeScript compilation and publish-level Homey validation via `App.preprocess()` / `App._validate()`. The generated demo's own type check passed. The final live UI and Flow verification is recorded above; physical HmIP-MOD-HO behavior still requires hardware testing. At this pre-release checkpoint, source had not yet been committed or published.

## Version 0.1.6 beta preparation (2026-10-04)

The owner accepted the garage UI/Flow result and explicitly authorized committing the changes first, publishing the next beta to GitHub and Homey via CLI, and updating the production app on Homey Christian. Version 0.1.6 collects the garage button, explicit Flow names and synchronized alias/read-back handling documented above; the existing RPC priority queue and concurrency limit predate this version. English/German Homey release notes and package manifests are aligned. GitHub publication will use a prerelease and Homey the Test channel. The source commit precedes uploading, tagging and installation.

Before the update, Homey Christian runs production version 0.1.5 from the App Store Test channel, with all 17 app devices available. The isolated demo remains separate. Installation preserves existing app data and device identities. Release packages are built from the committed source with no local environment configuration. Hardware validation remains limited as documented; the owner has accepted the native simulation UI.

Release validation for 0.1.6 passed `npm run check` (698 tests in 73 files, formatting, lint and both TypeScript checks) and complete production preprocessing with in-place publish validation. The package retains all 78 drivers, contains 17 custom Flow cards and all production dependencies, and excludes environment configuration, demo tooling and recorded fixtures.

Publication completed: release commit [`1c61da4`](https://github.com/branselbytes/homey-openccu/commit/1c61da4) was created before deployment and pushed to origin/main with annotated tag `v0.1.6`. The [GitHub prerelease](https://github.com/branselbytes/homey-openccu/releases/tag/v0.1.6) is public. A clean checkout of this tag, without `env.json`, was uploaded using `HOMEY_HEADLESS=1 homey app publish`. [Homey Developer Build 7](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/7) contains version 0.1.6, matching English/German release notes and zero environment keys, and was promoted to Test. The archive contains 631 files (7.77 MB). No Live promotion or upstream push was performed.

The exact 0.1.6 Test build was installed on Homey Christian through `homey api raw`, posting the Store installation request with version/channel and preserving app data. Verification at 38 seconds uptime confirms running/enabled/not crashed, App Store Test origin, automatic updates enabled, and all 17 existing device identities, driver assignments and prior capabilities retained with 17/17 available. The CCU reports a healthy connection, 35 discovered devices, zero discovery/metadata/system issues, zero failed/timed-out RPCs, an empty request queue and zero memory warnings. No physical actuator or heating schedule was changed. The isolated garage demo remains separate.

Changelog follow-up: at the owner's request, the 0.1.6 repository and GitHub release notes now also summarize the heating-group/thermostat weekly editor and memory improvements from 0.1.5, explicitly attributed to that earlier version. The source Homey release notes include the same recap. This is a text-only correction; the published Homey Build 7 and its uploaded changelog are unchanged, with no new build or installation.

## Version 0.1.7: HmIP-SRH Flow conditions (2026-10-10)

The owner requested resolving issue #2, publishing another GitHub/Homey beta and closing issues #1 and #2. Three named, invertible read-only handle-position conditions use the existing enum IDs and support dedicated/generic devices without re-pairing. Missing or invalid values reject the condition to prevent false positives when inverted. Integration tests reconstruct the reported channel metadata and simulate reads/callbacks through the production runtime; no physical HmIP-SRH is available for testing. Issue #1 was already fixed in 0.1.4/0.1.6 and confirmed by its reporter in forum posts 5 and 7. Release publication follows validation and a source commit, with issue closure after publication.

Validation passed: `npm run check` (715 tests in 74 files, formatting, ESLint and application/test type checks), production preprocessing/TypeScript compilation and Homey publish validation. Seventeen new tests cover all state comparisons, invalid/missing states, device filtering, legacy enum IDs and reconstructed-metadata integration through initial reads and callbacks, asserting no RPC writes. Physical handle testing and native Homey rendering of these new cards remain unverified.

0.1.7 delivery completed: source commit [`6cbe90d`](https://github.com/branselbytes/homey-openccu/commit/6cbe90d) and annotated tag `v0.1.7` were pushed to origin; the [GitHub prerelease](https://github.com/branselbytes/homey-openccu/releases/tag/v0.1.7) is public and its CI passed. A clean tagged checkout was uploaded through `HOMEY_HEADLESS=1 homey app publish`. [Homey Build 8](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/8) was verified for version, all three new conditions, matching EN/DE changelog and zero environment keys, then promoted to Test. The archive contains 632 files (7.78 MB). Issues [#1](https://github.com/branselbytes/homey-openccu/issues/1) and [#2](https://github.com/branselbytes/homey-openccu/issues/2) were commented with resolution evidence and closed as completed.

The exact 0.1.7 Test build was installed on Homey Christian via the CLI raw Store request, preserving app data. Verification at 41 seconds uptime confirmed running/not crashed, App Store Test origin, automatic updates enabled, all 17 existing IDs/drivers/capabilities preserved and 17/17 available. CCU discovery is healthy with 35 devices and zero discovery, metadata, system, RPC or timeout failures; memory warnings are zero. No physical control command or schedule write was performed. The handle conditions were integration-tested with simulated states; a physical handle test remains outside this delivery.

## Forum device integration — 0.1.8 beta (2026-10-10)

- [x] Verify original-app, aiohomematic/HA and manufacturer channel facts; record ADR 0028.
- [x] Add BROLL-2 family alias and retain SWDO-2 coverage.
- [x] Add twelve read-only FALMOT-C12 valve devices and five MIOB physical I/O devices.
- [x] Add HM-PB-2-FM battery status and short/long press Flow events using optional BidCos-RF.
- [x] Add separate BidCos callback/queue/retry settings, interface diagnostics, and callback-port release on reload.
- [x] Add synthetic protocol integration and configuration/lifecycle regression tests.
- [ ] Verify pairing, physical callbacks and commands on the requested hardware, including MIOB configured operating modes.
- [x] Publish 0.1.8 beta on GitHub and Homey Test (Build 9); manual Homey installation was not part of this release request.
