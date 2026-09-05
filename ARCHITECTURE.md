# Architecture

## Purpose and boundaries

**OpenCCU for Homey** is an independent Homey Pro app for locally pairing and operating Homematic and Homematic IP devices through OpenCCU. Existing devices from the former Homematic Homey app are not migrated; users pair them again in this app.

Required boundaries:

- Homey Apps SDK v3 on Homey software 12.9.0 or newer (Node.js 22 app runtime)
- direct local OpenCCU communication
- XML-RPC for HmIP-RF device descriptions, values, commands, and push events in the initial release
- JSON-RPC for metadata and hub objects such as names, rooms, functions, programs, and system variables
- no Home Assistant or Python runtime dependency
- no mandatory CCU-Jack, RedMatic, MQTT broker, or cloud service
- MQTT, if ever added, is an optional adapter and not part of the first implementation

## Imported baseline

The repository retains the history of `LRuesink-WebArray/homey-matic` (earliest commit 2018-09-01; imported head `e7a16bb`, 2022-02-11) and its MIT license. Local remotes are:

- `upstream`: `https://github.com/LRuesink-WebArray/homey-matic.git`
- `origin`: `https://github.com/branselbytes/homey-openccu.git`

No remote changes have been made.

### Imported implementation (historical analysis)

The imported baseline was a CommonJS JavaScript Homey app. Its generated `app.json` declared Apps SDK 3 and Homey compatibility `>=5.0.0`, while development tooling used the old `homey` 2.14 CLI package. It contained 105 product-specific driver directories and no automated tests. The table below records the source architecture that informed the migration; these runtime components have since been removed from the active tree and remain available through Git history.

The principal components are:

| Component            | Current responsibility                                              | Main concern                                                    |
| -------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `app.js`             | startup, settings, discovered bridges, transport selection          | global mutable app state; transport policy mixed into lifecycle |
| `HomeMaticDiscovery` | UDP broadcast discovery and bridge persistence                      | fixed ports, weak validation, no explicit multi-CCU lifecycle   |
| `HomeMaticCCURPC`    | constructs BidCos-RF, HmIP-RF, and CUxD clients                     | fixed interface/port table; CUxD uses BIN-RPC                   |
| `connection.js`      | callback server, XML-/BIN-RPC client, subscriptions, reconnect/ping | lifecycle races, timers, weak teardown/error semantics          |
| `HomeMaticCCUMQTT`   | RedMatic MQTT transport                                             | mandatory extra infrastructure when selected                    |
| `HomeMaticCCUJack`   | CCU-Jack HTTP/MQTT transport                                        | separate semantics and configuration surface                    |
| `lib/driver.js`      | common pairing and product-type filtering                           | pairing depends on static `homematicTypes` arrays               |
| `lib/device.js`      | capability reads/writes, conversions, event listeners               | static channel maps, broad listener removal, swallowed errors   |
| product drivers      | hard-coded channel/datapoint-to-capability maps                     | extensive duplication and poor unknown-device support           |

### Historical dependency and maintenance findings

- Direct dependencies are pinned to an old ecosystem: Axios 0.21, MQTT 3, node-fetch 2, `homematic-xmlrpc` 1.0.2, and `@twendt/binrpc` 3.3.2.
- The initial npm runtime audit reported five inherited vulnerabilities in Axios, legacy MQTT/WebSocket, and BIN-RPC paths. Those transports and dependencies have now been removed; the current production audit reports zero findings.
- `package.json` says ISC although the repository `LICENSE` is MIT; metadata must be reconciled without removing the original notice.
- Repository URLs and package/app identity still point to the predecessor (`twendt`, `de.twendt.homey.matic`).
- Generated `app.json` is very large because static driver definitions are expanded from Homey Compose.
- No TypeScript, lockfile, CI quality gate, test runner, fixtures, or reproducible OpenCCU simulator is present.
- Device initialization is not consistently awaited; several RPC/MQTT errors are swallowed or lose context.
- Reconnect timers and RPC callback servers lack a clear application shutdown/unsubscribe path.
- `removeAllListeners(eventName)` may remove another Homey device's listener for the same datapoint.
- Network discovery assumes UDP broadcast and fixed local binding, which may fail across VLANs or restricted Homey networks. Manual setup is required as a fallback.
- Authentication, TLS/HTTPS redirect, modern OpenCCU firewall behavior, IPv6, interface availability, and credential redaction are not modeled systematically.
- The baseline has no JSON-RPC metadata model, so CCU names, rooms, functions, programs, and system variables cannot yet be represented cleanly.

## Proposed architecture

```text
Homey app / pairing / settings / diagnostics
                    |
Homey device drivers and Flow cards
                    |
Capability mapper + profile registry + generic fallback
                    |
OpenCCU domain model (central, interface, device, channel, datapoint, hub object)
             /                         \
XML-RPC transport                 JSON-RPC client
(descriptions, values,            (metadata, programs,
 commands, callbacks)              system variables)
             \                         /
          connection lifecycle, cache, event bus, diagnostics
```

### 1. Transport layer

Expose typed interfaces independent of Homey:

- XML-RPC client methods for `listDevices`, `getParamsetDescription`, `getValue`, `setValue`, `putParamset`, and callback registration through `init`.
- A Homey-hosted XML-RPC callback server supporting `event`, `system.multicall`, `newDevices`, `deleteDevices`, and `updateDevice` where available.
- JSON-RPC client methods behind a narrow metadata/hub interface. Authentication, session renewal, timeout, and redaction belong here.
- One connection state machine per OpenCCU interface with bounded retries, backoff, health state, cancellation, and deterministic shutdown.

Backend detection should probe configured endpoints and query available interfaces instead of assuming that all fixed ports are active. The first release activates HmIP-RF only; BidCos-RF and CUxD remain future adapters. Automatic UDP discovery is a convenience; manual host configuration is a first-class path.

### 2. Domain model and cache

Represent OpenCCU data explicitly:

- central and interfaces (`BidCos-RF`, `HmIP-RF`, optionally CUxD)
- devices and channels from XML-RPC descriptions
- typed datapoint metadata from paramset descriptions (type, operations, flags, unit, min/max, value list, default)
- current value, availability, timestamp, and quality/state flags
- names, rooms, functions/trades, programs, and system variables from JSON-RPC

Persist only safe, versioned description/metadata caches. Live values remain event-driven and can be refreshed after reconnect. Cache keys must include central identity, interface, address, channel, paramset, and schema version.

The HmIP-RF client admits at most two concurrent XML-RPC calls. Registration and writes have priority over queued reads. `VALUES` paramset descriptions are persisted in Homey settings using schema-versioned envelopes; device callbacks invalidate only affected channel entries. A fresh `listDevices` call remains the source of current inventory on each connection.

### 3. Discovery and mapping

Discovery is data-driven:

1. enumerate interface devices and channels;
2. fetch paramset descriptions;
3. normalize datapoints into the domain model;
4. apply visibility rules;
5. apply a matching profile for composite behavior when one exists;
6. map remaining safe datapoints through generic rules;
7. emit diagnostic records for unsupported or ambiguous datapoints.

The mapper translates datapoints to Homey capabilities based on semantics and metadata, not only product model names. Examples include boolean writable state to `onoff`, level to `dim`, temperature units to temperature capabilities, and event-only keys to Flow triggers. Mappings must preserve channel identity to avoid collisions.

Profiles are declarative TypeScript data where possible and small typed adapters where behavior is genuinely composite (cover, climate, lock, siren, multi-channel devices). Profile precedence and every excluded datapoint should be explainable in diagnostics.

### 4. Homey adapter

Homey-specific classes consume the domain model rather than performing RPC directly. Pairing first selects/configures an OpenCCU, then lists logical devices derived from discovered channels. A stable Homey device identifier should combine central identity, interface, device address, and logical subdevice/profile identity.

Homey Compose remains the source of manifests. Each explicitly supported product keeps a dedicated Homey driver, backed by shared profiles and mapping services rather than copied logic. A separate generic fallback driver handles safe capabilities and diagnostics for unknown products. Manifest generation and consistency tests prevent the dedicated-driver catalog from drifting.

Multi-channel actuators remain one product driver but resolve into one pairable logical Homey device per output. Their stable identity appends a profile-owned logical ID to the central/interface/device address; existing single-device identities remain unchanged. Each logical device stores and re-resolves only its own bindings. OpenCCU channel names take precedence for output names when available, with a deterministic product/output fallback.

Flow cards should be capability-driven where Homey already supplies standard cards. Custom cards are reserved for Homematic events or commands without a standard Homey representation. Program execution and system-variable access belong to separate hub-level adapters/cards, not arbitrary device classes.

### 5. Events, availability, and diagnostics

A typed internal event bus decouples RPC callbacks from Homey devices. Subscriptions return an unsubscribe function; they must never remove listeners belonging to other devices. Reconnect reconciles descriptions and refreshes state before marking an interface healthy.

Homey devices activate only after the runtime is healthy. At activation, stored pair-time bindings are re-resolved against current discovery and persisted when they differ. Slow writes may be acknowledged optimistically to stay within Homey's listener window, but remain pending until a matching callback or bounded read-back verifies the OpenCCU value. A final differing read-back replaces the optimistic Homey value.

Diagnostics should include:

- app/build and sanitized runtime information;
- central type/version and detected interfaces, without credentials;
- connection transitions and categorized errors;
- raw-but-redacted device/channel/paramset descriptions;
- profile matching and capability mapping decisions;
- unknown or ignored datapoints with reasons;
- bounded recent event traces with values optionally omitted.
- XML-RPC active/queued/total/completed/failed/timeout counters without method parameters.

Diagnostic exports require explicit user action and deterministic secret redaction.

## Lessons adapted from the reference projects

`aiohomematic` is the useful domain/transport reference: it separates central coordination, protocol clients, generic/custom/calculated/hub datapoints, persistent caches, visibility rules, event routing, and backend detection. It also demonstrates per-interface connection state, retries/circuit breaking, and fixture-heavy tests. These concepts should be re-designed as idiomatic strict TypeScript rather than translated line by line.

`homematicip_local` is primarily an adapter from `aiohomematic` models to Home Assistant entities, setup flows, services, and diagnostics. Its useful lesson is the boundary between the protocol/domain library and platform entities. Home Assistant registries, services, MQTT integration, and Python runtime assumptions do not belong in this app.

Both references are MIT licensed. Any future substantial adaptation needs source-level attribution review; their licenses do not make Python packages suitable Homey runtime dependencies.

## Implemented foundation

Phases 2 and 3 provide a strict-TypeScript core under `src/`:

- typed XML-RPC operations for device discovery, paramset descriptions, reads, writes, paramset writes, and callback registration;
- a concrete HmIP-RF client adapter on port 2010 and a closeable callback server with direct and multicall event dispatch;
- a Fetch-based JSON-RPC 1.1 client with HTTP authentication, deduplicated OpenCCU login, session renewal/logout, abort/timeout handling, and categorized errors;
- a manual-host HmIP-RF reachability probe that classifies unavailable endpoints;
- bounded reconnect supervision with deterministic shutdown;
- normalized central, interface, device, channel, datapoint, program, and system-variable types;
- a device-graph builder deriving readable, writable, and eventable datapoints from operation flags;
- typed listener-specific event unsubscription, schema-versioned caches, bounded mapping explanations, and redacted diagnostic snapshots.

The core is wired through the strict-TypeScript `app.ts` lifecycle. Generated CommonJS output remains a build artifact under `.homeybuild/`.

The Phase 4 mapping prototype adds conservative generic rules and dedicated shared profiles. Known product types resolve to an existing product driver; unknown types resolve to `openccu-generic`. Generic `STATE` and `LEVEL` datapoints are mapped only when the channel type makes their meaning unambiguous. Every accepted or rejected mapping is recorded for diagnostics. Shared value transforms replace duplicated legacy conversions for booleans, current, energy, and percentage ratios.

Dedicated profiles may declare ordered fallback parameter names for firmware generations that expose the same semantic value under different XML-RPC names. Resolution selects the first available datapoint and stores that concrete binding, keeping runtime reads and callbacks deterministic.

Profiles may also require a discovered writable target before exposing a command capability. Simple commands remain typed single-datapoint writes; devices such as HmIP-ASIR use an explicit strategy that sends their acoustic, optical, and duration values in one atomic `putParamset` operation. Product command semantics stay outside the generic mapper and are covered by profile and runtime fixtures.

Profiles with topology controlled by device configuration may declare individual MASTER parameters. Discovery fetches only those declared values, normalizes ENUM indices through their `VALUE_LIST`, and keeps failures diagnosable. Profile conditions then gate logical devices and individual bindings. This avoids scanning every MASTER paramset while allowing HmIP-RGBW to expose only outputs valid for its configured RGB/RGBW, tunable-white, or PWM mode.

Stateless button presses are resolved separately from persistent capability bindings. Profiles declare logical button-channel indices; discovery admits only actually present `PRESS_SHORT` and `PRESS_LONG` datapoints. XML-RPC callbacks then emit one shared Homey device trigger with button number and press type tokens. Events are never persisted as device state, and a Flow-trigger failure is contained and logged at the Homey boundary.

The Phase 5 integration adds a Homey-independent HmIP discovery pipeline and runtime facade. It fetches channel `VALUES` paramsets with bounded concurrency, retains partial-discovery errors for diagnostics, builds stable pairing identities, and produces serializable candidates for either a dedicated profile driver or the generic fallback. XML-RPC callbacks enter the same typed event bus.

Manual connection settings have a strict parsing boundary that normalizes the central ID, host, HmIP-RF port, JSON-RPC URL, and optional credential pair. A runtime registry provides replace/remove/shutdown semantics and attempts to stop every configured central even when one shutdown fails. Homey settings persistence and credential ownership remain isolated in the Homey adapter.

The Homey boundary reads a versionable `openccu_connections` array, validates duplicate central identities, serializes reload operations, preserves an existing runtime when new settings are invalid, and removes settings listeners before shutdown. The settings page writes this format for one manually configured OpenCCU and no longer exposes MQTT, CCU-Jack, RedMatic, or legacy bridge controls.

The concrete managed-central runtime now owns one configured callback port per central. It waits until the callback server is listening, registers the advertised Homey address with HmIP-RF, refreshes discovery, retries failures with bounded backoff, publishes connection states, and performs best-effort deregistration before closing the server. Startup is deliberately non-blocking with respect to OpenCCU availability, so an offline central cannot prevent the Homey app from initializing. Callback address reachability has been verified on the current Homey Test/OpenCCU LAN, including live thermostat and weather-sensor events; VLAN, firewall, NAT, and alternate address-selection scenarios remain environment-specific risks.

Callback TCP connections are admitted only when their normalized remote address matches the configured OpenCCU host. Host names are resolved while a new socket is paused; mismatches and resolution failures are rejected before XML parsing. This reduces LAN event-injection risk but deliberately does not claim cryptographic authentication, and source-NAT or proxy deployments require an explicit future trust model.

The shared device-binding controller reconciles dynamic capabilities, reads initial values, routes commands and push events through the typed runtime, mirrors connection availability, and owns listener-specific cleanup. Resolved bindings retain separate read and write channel/parameter targets. Thin product-specific Homey adapters use shared HmIP profiles alongside `openccu-generic`; all other imported drivers and transports were removed from the active tree after their history was preserved.

Observed OpenCCU product suffixes such as `R4M` and `I9F` are normalized for profile selection. HmIP-eTRV-B-2 and eTRV-E variants use the shared radiator-thermostat profile. Custom Flow actions cover thermostat mode, boost, and week profile; standard Homey capabilities continue to supply temperature cards.

Authenticated JSON-RPC metadata loading now follows XML-RPC discovery without becoming part of XML-RPC connection health. The live-tested response adapters normalize `Device.listAllDetail`, `Room.getAll`, `Subsection.getAll`, `Program.getAll`, and `SysVar.getAll`; failures remain isolated per method. New pairing candidates prefer channel names, then device names, while already paired Homey names are never changed automatically. Rooms, functions, programs, and typed system-variable values remain available at the runtime boundary for later Flow and opt-in organization features.

Hub-level Flow cards use opaque central/object selections rather than exposing raw addressing. Autocomplete includes only non-internal programs and visible, non-internal system variables. Program execution calls `Program.execute`; variable writes call `SysVar.setValue` after normalizing NUMBER, ALARM, LOGIC, STRING, and LIST input. Equality conditions refresh JSON-RPC metadata before comparing, so Flow decisions do not rely on startup snapshots. Hub actions validate every selected ID against current metadata and remain separate from device capability commands.

Metadata methods run sequentially and each raw response is normalized before the next is requested, limiting peak allocations on Homey. The current regular test process remains below the memory warning threshold, while remote inspector mode can exceed it; production memory headroom must therefore be re-measured as device and Flow coverage grows.

The protected settings Web API exposes a downloadable support report assembled from aggregate runtime diagnostics. Centrals receive report-local aliases; credentials, network addresses, central IDs, OpenCCU object names, and datapoint values are excluded. A recursive redaction pass remains the final boundary in case diagnostic structures acquire sensitive fields later.

## Recorded decisions

- `docs/adr/0001-initial-product-scope.md`: HmIP-RF first; programs and system variables in the first usable release.
- `docs/adr/0002-homey-driver-strategy.md`: dedicated product drivers plus a generic fallback.
- `docs/adr/0003-typed-core-boundaries.md`: Homey-independent typed protocol, domain, cache, event, and diagnostic boundaries.
- `docs/adr/0004-bounded-rpc-and-confirmed-writes.md`: prioritized XML-RPC admission, persistent descriptions, repaired bindings, and verified commands.
- `docs/adr/0005-profile-driven-device-events.md`: discovery-checked stateless event bindings and shared Homey device triggers.
- `docs/adr/0006-logical-multi-channel-devices.md`: stable logical subdevices for independently controllable actuator outputs.
- `docs/adr/0007-product-command-strategies.md`: discovery-gated single-datapoint and atomic product commands.
- `docs/adr/0008-profile-configuration-conditions.md`: selective MASTER configuration reads and conditional profile topology.
- `docs/adr/0009-commonjs-build-output.md`: CommonJS runtime output generated from strict TypeScript into the ignored Homey build directory.
- `docs/adr/0010-openccu-metadata-and-naming.md`: best-effort JSON-RPC metadata loading and non-destructive pairing-name precedence.
- `docs/adr/0011-restrict-callback-source.md`: source-address admission for the unauthenticated XML-RPC callback listener.

## Architectural decisions still open

1. Authentication baseline: supported OpenCCU versions, TLS modes, self-signed certificates, and firewall configuration guidance.
2. Whether room/function metadata remains informational or can be mapped into Homey zones/tags through an explicit opt-in workflow.
3. Policy and review process for adapting device profiles or test fixtures from MIT reference projects.

## Principal risks

- Homey requires static driver manifests while generic OpenCCU discovery is dynamic.
- XML-RPC push requires OpenCCU to reach a callback server inside the Homey app; VLAN, firewall, NAT, and address selection can break events.
- Homematic channel semantics cannot always be inferred from datapoint types; complex devices require curated profiles.
- Adding many capabilities dynamically can create unstable device presentations or exceed practical Homey limits.
- The large static driver catalogue and remote debug inspector reduce memory headroom; release testing must track regular-process PSS separately from debug overhead.
- Modern OpenCCU authentication/TLS combinations vary; permissive fallbacks could create security problems.
- Useful device knowledge remains recoverable from the imported Git history, but only the currently profiled device families are active. Expanding dedicated coverage requires fixture- and hardware-backed profile work.
- Without representative hardware or recorded fixtures, protocol compatibility and event recovery cannot be proven locally.
