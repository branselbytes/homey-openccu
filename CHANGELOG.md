# Changelog

All notable changes to OpenCCU for Homey will be documented in this file. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are not considered released until explicitly tagged and published by the project owner.

## [Unreleased]

## [0.1.5] — prepared 2026-10-04

### Added

- English/German weekly schedule editor in app settings and thermostat/heating-group repair views. Edit existing device profile slots, copy days or profiles, and review changes before saving to OpenCCU.
- Metadata-based schedule limits, fresh-read conflict detection, per-target write protection and explicit pending/confirmed read-back status. Stored schedules and selectable active profiles remain separate.

### Changed

- Compact heating editor with direct weekday buttons, unsaved-day indicators and single-row time/temperature inputs on mobile. Schedule help and day/profile copying are expandable; touch targets and explicit save confirmation remain intact.

### Fixed

- Replace disposable discovery descriptions in Homey settings with a bounded in-memory cache, avoiding hundreds of settings mutations during registration and startup.
- Reduce repeated heating-profile parsing with bounded metadata reuse, coalesced reads and sequential large responses. Saves and read-back still fetch fresh metadata.
- Add bounded memory-warning diagnostics and on-demand process measurements where supported, without a debugger or app-side polling.

## [0.1.4] — prepared 2026-10-03

### Added

- HmIP-MOD-HO opening/stopping/closing controls, ventilation button and four-state position display, with English/German Flow actions and a position condition. Existing device IDs and native garage/light capabilities remain intact.
- Bounded support summaries with optional model-specific datapoint definitions for forum posts, alongside the complete JSON attachment.
- Safe XML-RPC fault codes in errors and the latest failed request in sanitized diagnostics, without remote messages or request arguments.

### Changed

- Redraw all 32 project-authored device icons and generated family variants with finer perspective outlines and corrected product forms; regenerate matching catalog images while retaining imported artwork and pairing paths.
- Refresh the English App Store description and add the matching German text, covering the fork's origin, current device scope, setup requirements and generic fallback limitations in Homey's plain-text format.
- Localize the generic pairing entry as "Generisches OpenCCU-Gerät" in German.
- Declare conservative capabilities for dedicated drivers so Homey can display their automatic Flow cards in the App Store, while retaining discovery-based device capabilities.
- Associate custom device Flow cards with their applicable drivers, including compatible legacy and generic devices.
- Align both widgets with Homey's typography, spacing and semantic colors; replace screenshot previews with transparent, text-free 1024px light/dark artwork.

### Fixed

- Accept the Hörmann module's numeric/symbolic unknown position without interrupting subsequent callback events or leaving a misleading closed state.
- Await actual RPC acknowledgements, including delayed errors, for write-only commands such as stop and ventilation; skip their impossible state read-back verification.
- Fall back when browser share/clipboard APIs reject access, and explain forum summaries versus GitHub JSON attachments in both languages.
- Use Homey's selected language for widget text instead of the browser language.
- Prevent overlapping widget refreshes and avoid clearing visible content during normal polling.
- Label unavailable/partial system status accurately and hide stale readings when system data is unavailable.

## [0.1.3] — prepared 2026-10-03

### Added

- Model-specific pairing icons for shared plug, SWDO and eTRV families.
- Original schematic artwork for devices without imported product drawings.
- PayPal donation metadata for the App Store, using the owner-provided PayPal.Me username.
- HmIP-PSM-2 and HmIP-PSM-2-A in the existing PSM family, with physical switch feedback, correctly targeted commands, metering, temperature and button events.
- HmIPW-STH and HmIPW-STH-A climate sensors, with temperature, humidity, setpoint and discovery-checked boost.
- Redacted recorded CCU device descriptions for PSM-2, Wired STH-A, three eTRV variants and three SWDO variants.

### Changed

- Adopt the owner-selected branselbytes circuit monogram and dark navy/copper smart-home scene as the app icon and App Store images, including a 1000 × 700 export.
- Combine PS and PSM switch/meter plugs into one pairing entry while retaining the legacy PS driver and unchanged per-model bindings.
- Combine the supported eTRV radiator thermostats into one pairing entry while retaining all previously shipped drivers and existing device identities.
- Remove obsolete JavaScript/legacy-directory build settings and exclude generated coverage from Homey packages.

### Fixed

- Replace unrelated socket/contact placeholder images with each driver’s own product artwork, restoring 39 image pairs from the imported project history.
- Refresh discovered devices after new/delete callbacks, serialize inventory updates and avoid nested discovery during initial registration or reconnect.
- Continue discovery through XML-RPC when optional description-cache reads, writes or invalidation fail.
- Detect profile type collisions using the same normalized model names as lookup.

## [0.1.2] — prepared 2026-10-03

### Added

- HmIP-SWDO-A support through the shared optical window/door contact profile.
- Discovery-checked detection enable controls for supported motion and presence sensors, including capability updates for existing paired devices.

### Changed

- Combine SWDO, SWDO-2, SWDO-I and SWDO-A into one localized pairing entry. Retain the old SWDO-2/SWDO-I drivers for existing devices and exclude already paired legacy/generic contacts from the shared pairing list.
- Align both OpenCCU widgets with the shared Homey typography.

### Fixed

- Use channel 3 for HmIP-SMI55 detection and illuminance.

## [0.1.1] — prepared 2026-09-08

### Added

- HmIPW-DRS8 with eight independent outputs and physical state feedback.
- HmIPW-DRI16 with 16 independently configured binary/button inputs and live mode reconciliation.
- HmIPW-DRAP diagnostics with separate bus measurements and fault indicators.
- HmIPW-SPI presence and illuminance; recorded BRC2 button-event coverage.
- HmIP-SWO-PR compass capability with full German/English direction names.

### Fixed

- Read MASTER configuration for devices whose PARENT field is empty.
- Refresh paired read-only input mappings after OpenCCU configuration notifications.

## [0.1.0] — initial beta

### Added

- Independent Homey Apps SDK v3 application identity and strict TypeScript foundation.
- Local HmIP-RF XML-RPC discovery, commands, confirmed writes, push callbacks, reconnect supervision, and generic unknown-device fallback.
- Dedicated product-facing drivers backed by shared profiles, including switches, dimmers, contacts, climate devices, thermostats, covers, blinds, locks, garage controllers, sirens, sensors, remotes, multi-output actuators, DALI, RGBW, irrigation, and weather devices.
- Independently supervised OpenCCU VirtualDevices transport and a dedicated HmIP heating-group driver.
- JSON-RPC metadata for names, rooms, functions, programs, and system variables, plus Homey Flow cards for program execution and typed system-variable access.
- Per-device OpenCCU room and function Flow tags, refreshed from JSON-RPC metadata without changing Homey zones.
- Read-only OpenCCU system device and privacy-reduced active service-message widget.
- Privacy-reduced OpenCCU system-status widget with connection, device, service-message, radio-load, and interface details.
- Explicit same-subnet UDP OpenCCU discovery in settings with manual-host fallback.
- English and German settings, capability labels, and Flow labels.
- Sanitized diagnostics with share/download/copy fallbacks and model-level device/mapping details for issue reports, plus callback source filtering, bounded XML-RPC admission, and schema-versioned caches.
- Product-specific and functional SVG driver icons under an MIT-safe sourcing policy.
- A consistent OpenCCU default icon for every driver without product artwork in the imported MIT history.

### Changed

- Changed the Homey/App Store display name to `OpenCCU Local`; the project and repository remain OpenCCU for Homey.
- Removed inherited MQTT, CCU-Jack, RedMatic, BIN-RPC, Axios, and Home Assistant runtime coupling.
- Replaced copied per-product runtime logic with typed transport, domain, mapping, profile, Homey-adapter, and diagnostic boundaries.
- Moved the active branch to `main` while retaining the imported Git history and `upstream` remote.
- Separated OpenCCU groups from physical thermostats in Homey's add-device selection while retaining thermostat semantics after pairing.

### Fixed

- Prefer the event-backed `ILLUMINATION` value for HmIP-SMI and HmIP-SPI when OpenCCU also exposes the unreliable `CURRENT_ILLUMINATION` datapoint.
- Size the system-status widget responsively without internal scrollbars or clipped content.

### Security

- Credentials and device values are excluded from logs and support reports.
- XML-RPC callback connections are restricted to the configured OpenCCU source address.
- Discovery responses are structurally validated and are never saved without explicit user action.

### Known limitations

- Only HmIP-RF physical devices and HmIP heating groups are in the current scope.
- Most product drivers are fixture-verified and still require individual hardware validation.
- UDP discovery is broadcast-domain limited; routed/VLAN installations must use manual host entry.
- OpenCCU rooms and functions are exposed as device tags but do not create or move Homey zones.
- There is no migration from the predecessor Homey app; devices are paired again.
