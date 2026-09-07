# ADR 0014: Device icon sourcing and fallback

## Status

Accepted

## Context

Homey requires a local `assets/icon.svg` for every driver. The imported MIT-licensed `homey-matic` history contains product-specific SVGs for some current HmIP drivers, but not for every driver added by this project.

OpenCCU's OCCU WebUI product PNGs are governed by the eQ-3 HomeMatic Software License (HMSL). Their redistribution conditions are not equivalent to MIT, and generic functional drawings can misleadingly suggest that a product-specific original is available.

## Decision

Retain product-specific SVGs only where the corresponding driver icon exists in the imported MIT history. Drivers without such an original use the project's neutral `assets/default-device.svg`, copied to the driver-local path required by Homey.

The default icon is original project artwork under the repository's MIT license. Do not copy, trace, convert, package, or fetch HMSL-governed OpenCCU product images at runtime.

Review new product icons for provenance before replacing the default. Record any accepted source in `THIRD_PARTY_NOTICES.md`.

## Consequences

- Every active driver always has a valid local icon.
- Missing artwork is visually honest and consistent.
- Original MIT-imported product icons remain recognizable.
- Adding a driver without approved artwork requires the shared default rather than a guessed product drawing.
