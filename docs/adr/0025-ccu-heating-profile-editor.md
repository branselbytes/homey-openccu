# ADR 0025: Edit CCU heating schedules from Homey

Status: accepted for implementation, 2026-10-04.

## Context

The existing thermostat capability selects an active profile but cannot display or edit the stored weekly schedule. Read-only checks against the configured CCU found three schedules in the sampled eTRV variants and six in STH/Wired STH and HmIP-HEATING. The heating group's ACTIVE_PROFILE metadata permits only 1–3, independently of its six stored schedules. Homey's standard device settings cannot host a custom weekly editor; app settings and device repair views can.

## Decision

Keep schedule execution on the CCU/devices. Add a shared localized editor to app settings and the supported drivers' repair views. The app-level entry lists paired Homey thermostats/groups; repair binds directly to its supplied device. Resolve every request against an existing paired device and live discovered CCU identity rather than accepting arbitrary XML-RPC addresses or parameter names from the browser.

Separate the schedule domain and XML-RPC service from Homey adapters and HTML presentation. Discover complete Pn_ENDTIME/Pn_TEMPERATURE weekly schemas from channel MASTER metadata on demand. Keep stored/editable schedules separate from profiles selectable through VALUES. Save one complete profile through a bounded MASTER patch, validate types, rights, temperatures and ordered day intervals, and preserve unrelated settings and profiles. Compare a fresh schema/value revision before writing, serialize writes per target, await the actual acknowledgement and report whether read-back confirmed the change. Never automatically retry a configuration write or claim that an acknowledged but unconfirmed update is already applied.

The editor provides an explicit save action; viewing and copying drafts do not write to the CCU. Profile reads and drafts are not added to diagnostic exports or logs. Existing device identities, capabilities, callbacks and transport requirements remain unchanged. General CCU device settings are a separate feasibility review in this task, not an unbounded configuration-write API.

The shared browser sources remain `assets/heating-editor.js` and `.css`. After changing them, run `npm run heating:assets` before the Homey build. This synchronizes only those two files into the repair template's `assets` directory; Homey Compose expands `{{assets}}` and packages a local asset directory for each repair view. This avoids depending on traversal from a hosted repair iframe to app-root resources. A test rejects drift between the authored files and the template copies.

## References

- [Homey app settings](https://apps.developer.homey.app/advanced/custom-views/app-settings)
- [Homey repair views](https://apps.developer.homey.app/the-basics/devices/pairing#repairing)
- [eQ-3 XML-RPC specification](https://www.eq-3.de/Downloads/eq3/download%20bereich/hm_web_ui_doku/HM_XmlRpc_API.pdf)
- [aiohomematic schedule reference, pinned](https://github.com/SukramJ/aiohomematic/blob/3ced0fd3c9e9f741978dc5e079a1fc145396c481/aiohomematic/model/week_profile.py): design reference only; no substantial copied code.

## Validation

Domain and adapter tests use anonymized recorded metadata and synthetic schedules/acknowledgements. Browser checks cover both entry points, languages, narrow layouts, copying, validation, unsaved changes, conflicts and pending writes. Physical configuration writes and Homey deployment require a separately requested rollout; implementation itself does not change a live heating schedule.
