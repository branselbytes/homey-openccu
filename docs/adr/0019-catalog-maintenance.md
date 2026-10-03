# ADR 0019: Catalog consolidation and resilient inventory maintenance

- Status: accepted
- Date: 2026-10-03
- Extends: ADR 0018; amends ADR 0002 for the eTRV family

## Context

The installed app is stable. A catalog audit found identical eTRV profiles and two real devices still using generic mapping: PSM-2 lacks a generic on/off mapping because its feedback and virtual command channels differ; Wired STH-A lacks the boost mapping. An optional cache error can unnecessarily hide channel datapoints, and new/delete callbacks invalidate descriptions without refreshing the inventory.

## Decision

- Consolidate existing eTRV types under HmIP-eTRV-2 without changing their bindings. Ship previous driver IDs as deprecated adapters, and filter cross-driver duplicate pairings as for SWDO.
- Keep original PSM behavior intact. Route PSM-2/-2-A to the PSM family through a separate discovery-checked profile with physical feedback on channel 2 and commands on channel 3. Keep temperature already exposed by generic mapping.
- Add one Wired STH/-A driver using the existing temperature, humidity, setpoint and boost bindings. Defer mode (0–3) and week-profile (1–6) controls because the current Homey enums only support 0–1 and 1–3. Verify new types with recorded device/paramset metadata and clearly label simulated values, commands and unrecorded color aliases.
- Retain existing device IDs and let the established binding reconciliation add supported capabilities; no deletion, re-pairing or driver-ID migration.
- Normalize profile collision checks using the same model normalization as lookup.
- Serialize inventory changes following new/delete/update callbacks and reuse the lifecycle abort signal. Registration/reconnect callbacks must return without nested discovery RPCs. Collect registration-time changes for a refresh after the connection becomes healthy. Optional cache failures are diagnostic issues, not reasons to discard valid RPC descriptions; failed invalidation disables that runtime instance’s persistent cache to prevent stale reads.

## Consequences

New pairing is simpler for eTRV, and observed devices gain useful dedicated mappings. Retained legacy adapters continue to occupy package space because they preserve installed devices. Physical command behavior and real callback/upgrade scenarios still require hardware validation before the new batch is described as verified in production.
