# Recorded OpenCCU descriptions

`device-families.json` was captured read-only from the configured OpenCCU on 2026-10-03 using `listDevices` and channel `getParamsetDescription(..., "VALUES")`. It contains PSM-2, Wired STH-A, eTRV-2 I9F, eTRV-B-2 R4M, eTRV-E-A, SWDO-A, SWDO-2 and HMIP-SWDO descriptions.

Addresses and parent/child references are replaced consistently with CATALOG1–CATALOG8 identities. The file retains only device type/firmware, channel topology and selected datapoint metadata (type, operations, flags, bounds, units and enum labels). It contains no credentials, host addresses, device names, room names or live datapoint values.

Tests supply synthetic initial values, callback events and command responses. Changing a recorded device's type to test a documented model/color alias does not make that alias hardware verified. The existing wired-devices and wired-infrastructure recordings retain their original provenance in DEVICE_SUPPORT.md and IMPLEMENTATION_PLAN.md.

All fixtures are excluded from the Homey application package by .homeyignore.
