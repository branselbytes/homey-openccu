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

### Current implementation

The baseline is a CommonJS JavaScript Homey app. Its generated `app.json` already declares Apps SDK 3 and Homey compatibility `>=5.0.0`, while development tooling uses the old `homey` 2.14 CLI package. It contains 105 product-specific driver directories, each with a `driver.js`, `device.js`, and compose manifest; 41 contain dedicated flow manifests. There are no automated tests.

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

### Dependency and maintenance findings

- Direct dependencies are pinned to an old ecosystem: Axios 0.21, MQTT 3, node-fetch 2, `homematic-xmlrpc` 1.0.2, and `@twendt/binrpc` 3.3.2.
- The initial npm runtime audit reports five inherited vulnerabilities: three high-severity findings in Axios and legacy MQTT/WebSocket paths and two low-severity findings including the unmaintained `put` dependency used by BIN-RPC. They remain isolated as known migration debt; forced upgrades would change legacy behavior, and the out-of-scope transports are scheduled for removal or replacement.
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

Flow cards should be capability-driven where Homey already supplies standard cards. Custom cards are reserved for Homematic events or commands without a standard Homey representation. Program execution and system-variable access belong to separate hub-level adapters/cards, not arbitrary device classes.

### 5. Events, availability, and diagnostics

A typed internal event bus decouples RPC callbacks from Homey devices. Subscriptions return an unsubscribe function; they must never remove listeners belonging to other devices. Reconnect reconciles descriptions and refreshes state before marking an interface healthy.

Diagnostics should include:

- app/build and sanitized runtime information;
- central type/version and detected interfaces, without credentials;
- connection transitions and categorized errors;
- raw-but-redacted device/channel/paramset descriptions;
- profile matching and capability mapping decisions;
- unknown or ignored datapoints with reasons;
- bounded recent event traces with values optionally omitted.

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

This core is not yet wired into `app.js` or the legacy drivers. That integration belongs to the mapping/driver phases and must preserve a testable rollback boundary.

The Phase 4 mapping prototype adds conservative generic rules and dedicated shared profiles. Known product types resolve to an existing product driver; unknown types resolve to `openccu-generic`. Generic `STATE` and `LEVEL` datapoints are mapped only when the channel type makes their meaning unambiguous. Every accepted or rejected mapping is recorded for diagnostics. Shared value transforms replace duplicated legacy conversions for booleans, current, energy, and percentage ratios.

The first Phase 5 integration seam adds a Homey-independent HmIP discovery pipeline and runtime facade. It fetches only channel `VALUES` paramsets with bounded concurrency, retains partial-discovery errors for diagnostics, builds stable pairing identities, and produces serializable candidates for either a dedicated profile driver or the generic fallback. XML-RPC callbacks enter the same typed event bus. The legacy `app.js` and drivers are deliberately not switched over until Homey lifecycle, callback-server startup, configuration storage, and repair behavior can be integrated as one tested boundary.

Manual connection settings now have a strict parsing boundary that normalizes the central ID, host, HmIP-RF port, JSON-RPC URL, and optional credential pair. Diagnostic views receive only a credential-free projection. A runtime registry provides replace/remove/shutdown semantics and attempts to stop every configured central even when one shutdown fails. Homey settings persistence and credential ownership remain adapter concerns and are the next integration task.

The Homey boundary now reads a versionable `openccu_connections` array, validates duplicate central identities, serializes reload operations, preserves an existing runtime when new settings are invalid, and removes settings listeners before shutdown. The settings page writes this format for one manually configured OpenCCU and no longer exposes MQTT, CCU-Jack, RedMatic, or legacy bridge controls. The external Homey MQTT-app permission has consequently been removed. The active `app.js` still uses the legacy lifecycle until the concrete XML-RPC callback/supervisor runtime factory is complete and tested.

The concrete managed-central runtime now owns one configured callback port per central. It waits until the callback server is listening, registers the advertised Homey address with HmIP-RF, refreshes discovery, retries failures with bounded backoff, publishes connection states, and performs best-effort deregistration before closing the server. Startup is deliberately non-blocking with respect to OpenCCU availability, so an offline central cannot prevent the Homey app from initializing. Callback address reachability and port/firewall behavior still require Homey/OpenCCU hardware validation.

The shared device-binding controller reconciles dynamic capabilities, reads initial values, routes commands and push events through the typed runtime, mirrors connection availability, and owns listener-specific cleanup. Resolved bindings retain separate read and write channel/parameter targets; this is required for devices such as covers whose status and command channels differ. The concrete Homey device class remains a thin pending adapter around this tested controller.

## Recorded decisions

- `docs/adr/0001-initial-product-scope.md`: HmIP-RF first; programs and system variables in the first usable release.
- `docs/adr/0002-homey-driver-strategy.md`: dedicated product drivers plus a generic fallback.
- `docs/adr/0003-typed-core-boundaries.md`: Homey-independent typed protocol, domain, cache, event, and diagnostic boundaries.

## Architectural decisions still open

1. Authentication baseline: supported OpenCCU versions, TLS modes, self-signed certificates, and firewall configuration guidance.
2. Naming precedence between OpenCCU names and user-chosen Homey names, and whether room/function metadata only assists pairing or also maps into Homey zones/tags.
3. Policy and review process for adapting device profiles or test fixtures from MIT reference projects.

## Principal risks

- Homey requires static driver manifests while generic OpenCCU discovery is dynamic.
- XML-RPC push requires OpenCCU to reach a callback server inside the Homey app; VLAN, firewall, NAT, and address selection can break events.
- Homematic channel semantics cannot always be inferred from datapoint types; complex devices require curated profiles.
- Adding many capabilities dynamically can create unstable device presentations or exceed practical Homey limits.
- Modern OpenCCU authentication/TLS combinations vary; permissive fallbacks could create security problems.
- A large rewrite could regress the useful device knowledge embedded in 105 legacy drivers. Extracting that knowledge into fixtures/profiles before removal reduces the risk.
- Without representative hardware or recorded fixtures, protocol compatibility and event recovery cannot be proven locally.
