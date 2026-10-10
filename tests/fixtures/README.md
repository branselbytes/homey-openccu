# Recorded OpenCCU descriptions

`device-families.json` was captured read-only from the configured OpenCCU on 2026-10-03 using `listDevices` and channel `getParamsetDescription(..., "VALUES")`. It contains PSM-2, Wired STH-A, eTRV-2 I9F, eTRV-B-2 R4M, eTRV-E-A, SWDO-A, SWDO-2 and HMIP-SWDO descriptions.

Addresses and parent/child references are replaced consistently with CATALOG1–CATALOG8 identities. The file retains only device type/firmware, channel topology and selected datapoint metadata (type, operations, flags, bounds, units and enum labels). It contains no credentials, host addresses, device names, room names or live datapoint values.

Tests supply synthetic initial values, callback events and command responses. Changing a recorded device's type to test a documented model/color alias does not make that alias hardware verified. The existing wired-devices and wired-infrastructure recordings retain their original provenance in DEVICE_SUPPORT.md and IMPLEMENTATION_PLAN.md.

All fixtures are excluded from the Homey application package by .homeyignore.

`heating-master.json` was captured read-only on 2026-10-04 using `listDevices` and `getParamsetDescription`. It contains weekly MASTER parameter descriptions and ACTIVE_PROFILE metadata for HmIP-eTRV-B-2 R4M (1.4.0), HmIP-STH (3.0.2) and HmIP-HEATING (2.0.0). Only model/firmware, numeric channel indices and relevant parameter metadata remain; there are no device addresses, names, credentials or live schedule values. Tests supply synthetic schedules and write acknowledgements. Six stored group profiles with ACTIVE_PROFILE limited to 1–3 are intentionally retained.

`hoermann-mod-ho.json` contains selected channel/datapoint metadata from the diagnostic attachment to [issue #1](https://github.com/branselbytes/homey-openccu/issues/1), reviewed on 2026-10-03 (HmIP-MOD-HO firmware 1.0.16). Device/channel identities are synthesized as `HOERMANN1`; no original identities, names, network addresses or live values are retained. String enum and boolean bounds are preserved as reported. Runtime tests simulate all states, callbacks, write acknowledgements and errors; physical motor/light operation remains unverified.

`srh-handle.json` reconstructs the selected channel-1 STATE metadata from the sanitized summary in [issue #2](https://github.com/branselbytes/homey-openccu/issues/2), reviewed on 2026-10-10 (HmIP-SRH firmware 1.2.12). Topology and identities are synthetic (`HANDLE1`); enum ordering and read/event operations are retained from the report. Runtime values and callbacks are simulated; this is not a new hardware recording.
