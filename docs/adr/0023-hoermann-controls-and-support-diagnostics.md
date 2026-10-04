# ADR 0023: Hörmann controls and actionable support diagnostics

- Status: accepted
- Date: 2026-10-03
- Extends: ADRs 0004 and 0007

## Context

[Issue #1](https://github.com/branselbytes/homey-openccu/issues/1) and the [associated forum report](https://community.homey.app/t/app-pro-homematic-ip-local-openccu/160314/2) describe missing HmIP-MOD-HO controls, generic `XML-RPC setValue failed` errors for both the motor and light, and difficulties sharing a 68 KB JSON report. The attached firmware 1.0.16 metadata confirms a write-only `DOOR_COMMAND` enum on channel 1, a separate four-state `DOOR_STATE`, and boolean light `STATE` on channel 2. `POSITION_UNKNOWN` is valid but previously threw in our transform, aborting the remaining events in a callback batch.

The manufacturer's functions and the Home Assistant reference agree on open, close, stop and ventilation. The current `aiohomematic` implementation writes enum names for string-based HmIP metadata. Our existing light target and OPEN/CLOSE strings therefore do not explain the reported write rejection. The old imported driver used integer commands, but also failed to await its writes; absence of an old UI error is not proof that those commands succeeded.

## Decision

- Keep existing device IDs, driver assignments, `garagedoor_closed` and `onoff`. Extend the shared HmIP-MOD-HO profile and let initialization reconcile existing bindings and add capabilities without re-pairing. Leave MOD-TM behavior unchanged.
- Add a native ternary command control for opening/stopping/closing, a stateless ventilation button, and a read-only state sensor with closed/open/ventilation/unknown. Use explicit `OPEN`, `STOP`, `CLOSE` and `PARTIAL_OPEN` commands on channel 1. Keep boolean light commands on channel 2. Do not invent a percentage position from discrete states.
- Map both numeric and symbolic `POSITION_UNKNOWN` to `null` for the native closed-state capability and `unknown` for the detailed state. A valid unknown state must not interrupt subsequent callbacks or imply a closed door.
- Give command-only bindings no state read-back verification: await the actual XML-RPC acknowledgement or error, and let separate state datapoints report the physical result. Do not apply the early 1.5-second UI acknowledgement to write-only commands, otherwise a later rejection could be hidden from a Flow with no readable state to verify. Retain existing confirmation handling for readable state bindings and never retry motor commands automatically.
- Add capability-filtered, localized Flow actions for door commands and ventilation, plus a condition for the detailed reported position. Use Homey's standard cards for the existing native controls.
- Preserve only a typed method, protocol error category and bounded integer CCU fault code from the latest failed RPC. Retain that failure across successful polling until another failure or a new client. Do not expose remote error strings, request arguments, device addresses or credentials. Safe fault codes appear in the user-facing protocol error and sanitized reports.
- Keep the complete JSON export and provide a bounded plain-text summary for forum posts, optionally focused on a model's schema. Explain JSON attachment use on GitHub in English and German. Fall back from rejected share/clipboard APIs to download/manual copy, while honoring cancellation.

## Consequences and validation

Recorded metadata and synthetic callbacks/acknowledgements cover profile resolution, unchanged identity, command routing, all four states, unknown-state batches followed by light events, and write-only verification. They do not prove that the reporter's physical drive accepts commands. The precise cause of the outgoing write failure remains open until a new fault code or a physical test is available. No commands are sent to a real motor as part of this change.

The reference projects remain design references only. No Python code or runtime dependency is copied. The fixture contains selected metadata from the submitted report with synthesized identities and no live values. Native UI rendering and real device operation require an authorized Homey installation.

References reviewed: [manufacturer datasheet](https://homematic-ip.com/sites/default/files/downloads/hmip-mod-ho-153986a0-datasheet.pdf), [aiohomematic garage model](https://github.com/SukramJ/aiohomematic/blob/3ced0fd3c9e9f741978dc5e079a1fc145396c481/aiohomematic/model/custom/cover.py#L566), [enum serialization](https://github.com/SukramJ/aiohomematic/blob/3ced0fd3c9e9f741978dc5e079a1fc145396c481/aiohomematic/model/data_point.py#L1408), [Home Assistant cover description](https://github.com/SukramJ/homematicip_local/blob/2a49f5484b6f9da6673a8d136fc87449b29980cc/custom_components/homematicip_local/entity_helpers/descriptions/covers.py#L37), [pydevccu device metadata](https://github.com/SukramJ/pydevccu/blob/6fe7695f049219c77cbda2b60131fdf61d836000/pydevccu/paramset_descriptions/HmIP-MOD-HO.json), and [Homey native capability components](https://apps.developer.homey.app/the-basics/devices/capabilities).
