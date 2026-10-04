# ADR 0022: Store capabilities and native widget presentation

- Status: accepted
- Date: 2026-10-03
- Extends: ADR 0002

## Context

The public App Store shows all seven custom Flow cards, but most automatic device cards are missing because nearly all driver manifests declare an empty capability list. Pairing already supplies capabilities from discovered XML-RPC bindings. The two widgets use smaller custom typography than Homey's documented defaults, and their screenshot previews do not meet the Store's requirements for simplified transparent artwork.

## Decision

- Describe a conservative baseline of supported capabilities in dedicated, visible driver manifests so Homey can advertise automatic Flow cards. Keep the generic fallback and configuration-dependent functions discovery-driven. A shared family advertises only the baseline common to its supported variants; optional functions are not promised for every model.
- Keep the existing Homey minimum version. Omit newer system capabilities from the static baseline. Where a model/family has no verified battery type/count metadata, omit static battery capabilities instead of inventing the `energy.batteries` values required by Homey's publish validator. Discovery still exposes supported battery functions on paired devices; button-only drivers can be represented by their custom trigger without static capabilities.
- Continue supplying explicit discovered capabilities during pairing and reconciling existing devices against their stored/resolved bindings. Catalog metadata does not determine command targets, device identity or live capabilities.
- Associate device-specific custom Flow cards with their supported driver IDs. Preserve capability filters for thermostat actions, retained legacy drivers and applicable generic devices. Keep program and system-variable cards at app level.
- Use Homey's documented widget spacing, typography and semantic colors, with localized strings resolved through `Homey.__`. Keep system status at content height and service messages as a bounded scrollable list.
- Represent unavailable system data explicitly, hide stale readings, and serialize refreshes in each widget. Preserve the privacy-reduced backend views and use text nodes for all API-provided content.
- Generate original, text-free light/dark widget preview artwork at 1024 × 1024 with a transparent outer canvas. Use the existing development renderer; do not add a runtime dependency.

## Consequences

Store cards are more representative of the implemented integration, but a static catalog cannot enumerate every dynamically discovered or configuration-dependent feature. The actual device remains authoritative. Local metadata and asset changes appear in the Store only after an authorized upload and publication. Browser checks use synthetic data; an actual Homey dashboard and device upgrade remain separate validation steps.

References: [Homey widget styling](https://apps.developer.homey.app/the-basics/widgets/styling), [Store guidelines](https://apps.developer.homey.app/app-store/guidelines), [custom-view translations](https://apps.developer.homey.app/the-basics/app/internationalization).
