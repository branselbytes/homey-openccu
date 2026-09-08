# Changelog

All notable changes to OpenCCU for Homey will be documented in this file. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are not considered released until explicitly tagged and published by the project owner.

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
