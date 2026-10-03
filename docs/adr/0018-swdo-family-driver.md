# ADR 0018: Shared SWDO family driver

- Status: accepted
- Date: 2026-10-03
- Amends: ADR 0002 for the SWDO family

## Context

SWDO, SWDO-2 and SWDO-I already expose the same contact and low-battery bindings through separate profiles and Homey drivers. Adding the user's SWDO-A should not require another identical pairing entry. Existing installations must retain their devices and Flows.

## Decision

- Reuse the existing `HMIP-SWDO` driver and `hmip-contact` profile for the explicitly listed SWDO, SWDO-2, SWDO-I and SWDO-A types. Keep discovery-gated `STATE` on channel 1 and `LOW_BAT` on channel 0. Do not match unknown suffix variants by prefix.
- Give the shared driver an English/German family name. Keep the shipped `HmIP-SWDO-2` and `HmIP-SWDO-I` directories, classes and IDs, with `deprecated: true` as described by the [Homey driver documentation](https://apps.developer.homey.app/the-basics/devices#deprecated).
- Keep the stable central/interface/address identity and stored bindings. Runtime binding resolution follows the discovered device type, not the stored profile ID, so existing devices need no migration or re-pairing.
- Opt the shared SWDO driver into filtering devices already paired through the two legacy drivers or `openccu-generic`, comparing full stable IDs to avoid duplicate pairings across driver IDs.
- Retain product-specific drivers for other device families.

## Consequences

Users see one entry when adding these optical contacts. Existing Homey device identities and Flow references remain intact. Legacy driver adapters remain part of the package. Unknown SWDO variants retain generic discovery until their mappings are verified. Dedicated synthetic XML-RPC tests cover discovery, initial reads, callbacks and unchanged legacy bindings; they do not substitute for SWDO-A hardware verification.
