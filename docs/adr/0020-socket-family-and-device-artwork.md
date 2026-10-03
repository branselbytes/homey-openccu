# ADR 0020: Shared socket pairing and accurate device artwork

- Status: accepted
- Date: 2026-10-03
- Extends: ADR 0014, ADR 0018 and ADR 0019

## Context

The owner requested fewer socket pairing entries and correct pictures both in the catalog and on devices. The catalog contained only six product PNG pairs reused across 78 drivers, making unrelated actuators and sensors look like sockets or window contacts. Exact-model image pairs for 45 current drivers are available in the preserved upstream history. The owner explicitly approved appropriate schematic device drawings for the remaining products.

## Decision

- Route new PS and PSM pairings through HMIP-PSM. Preserve separate PS, PSM and PSM-2 profiles, write targets, identities and capabilities. Keep the old PS driver as a deprecated adapter and exclude existing legacy/generic devices from new pairing.
- Keep plug dimmers and USB, flush-mounted, PCB and DIN-rail devices separate. An incorrectly reused socket picture does not make them the same product family.
- Restore 39 missing exact-model PNG pairs from imported ancestor `e7a16bb12dca80bad04e0527870f5a64ed03ef28`. Preserve imported artwork attribution and history.
- Give every driver its own image paths. For known products without imported artwork, use original project-authored schematic SVG drawings based on device form and function, rendered as white-background 75/500 px PNGs. The genuinely generic driver retains neutral artwork.
- Supply a model-specific `icon` in new shared-family pairing results. Select only fixed driver-local asset paths from normalized known model names; never turn arbitrary CCU strings into filesystem paths. Unknown models keep the driver default.
- Do not add remote image loading, proprietary OCCU artwork, new runtime dependencies, or broad Homey API permissions.

## Consequences

Catalog entries become distinguishable and existing standalone/legacy drivers receive corrected packaged artwork. Model-specific family icon selection applies to newly paired devices. Existing per-device icon overrides are preserved: the documented Homey Apps SDK exposes pairing icons but no `Device.setIcon` method. We do not delete or re-pair devices merely to change their appearance.

Schematic drawings are not manufacturer photographs and do not establish new hardware support. Product support remains controlled by profiles and discovered datapoints. The SVG generator is development tooling and is excluded from the Homey package. Hardware UI/cache behavior must still be checked after an owner-authorized app update.

## References

- [Homey device pairing data](https://apps.developer.homey.app/the-basics/devices/pairing#device-pairing-data)
- [Homey Device API](https://apps-sdk-v3.developer.homey.app/Device.html)
- `THIRD_PARTY_NOTICES.md`
