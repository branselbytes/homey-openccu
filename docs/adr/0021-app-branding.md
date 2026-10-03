# ADR 0021: Independent branselbytes app branding

- Status: accepted
- Date: 2026-10-03

## Context

The owner selected the second proposed visual direction: a black interlocking bb circuit monogram and a dark navy/copper scene with wireless and Wired smart-home devices and a local computer.

## Decision

- Replace `assets/icon.svg` with native vector paths on a transparent background, without a wordmark or embedded bitmap.
- Export the generated scene as local PNGs at 250 × 175, 500 × 350 and 1000 × 700, referenced from the compose manifest. Keep the existing navy brand color.
- Retain the approved concept, generated source and production prompts in `docs/design/branding/`, excluded from Homey packages with the rest of the documentation.
- Treat devices in the scene as illustrative, unbranded smart-home equipment; do not imply manufacturer endorsement. Preserve original-project attribution, licenses and history.

## Consequences

Only app-level presentation changes. Device-specific artwork, app identity, pairing, capabilities and runtime behavior remain independent of the branding. Installation and App Store publication are separate release actions.
