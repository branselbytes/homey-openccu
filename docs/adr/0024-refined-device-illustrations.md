# ADR 0024: Refined device illustrations

- Status: accepted
- Date: 2026-10-03
- Extends: ADR 0020

## Context

The owner found the project's own device icons too rough and requested a fresh
check of OpenCCU image reuse, with redrawing as the alternative. The existing 32
generated driver icons use heavy frontal pictograms that differ noticeably from
the inherited perspective illustrations. Some also misrepresent physical form:
MOD-TM is an enclosed module, USBSM is a PCB, and the basic radiator thermostat is
not a horizontal box with three circular buttons.

The [source review](../design/device-artwork-license-review.md) distinguishes
OpenCCU's own artwork notice from the manufacturer's conditional HMSL grant.
Manufacturer PNG reuse is conditionally possible, including separately licensed
assets in a MIT app. It would require complete asset license/pass-through
arrangements and would not directly supply Homey's required SVG icons.

## Decision

- Use the already authorized alternative: independently authored SVG geometry
  informed by physical proportions and visible controls. Do not copy, trace,
  raster-embed or convert the manufacturer/OpenCCU artwork.
- Redraw all 32 project-generated driver icons and the two additional generated
  family icons. Keep inherited icons, driver IDs, capability bindings and pairing
  paths intact. Synchronize the three generated family copies.
- Follow Homey's recognizable monochrome line-art approach: transparent square
  SVGs, finer contours, restrained detail and perspective where appropriate.
  Center each illustration with a consistent 48px margin on its longest axis
  within the 960px canvas, preserving its aspect ratio. Render matching 75/500px
  white-background catalog PNGs from the same source.
- Correct product features as well as style: thin contacts, vertical thermostats,
  the door lock's three vertically arranged controls, valve housing and water
  ports, weather sensor assemblies, DIN displays, and PCB/enclosure distinctions.
  Repeated housing geometry is intentional where the product family shares it.
  For the ambiguous legacy `HmIP-FSI` name, retain the conservative FSI16 family
  enclosure without claiming an independently verified product drawing.
- Split authored coordinates into electrical, household and sensor modules under
  `scripts/`. Retain one reproducible generator and its existing development-only
  renderer. Do not add a runtime dependency or remote image loading.

## Consequences

The artwork remains original project work under MIT. It illustrates product
recognition, not terminal assignments, wiring instructions or new hardware
support. Virtual system/heating-group devices receive neutral semantic drawings.
Manufacturer photographs used to inspect physical form remain outside the
repository and app package. Preview sheets contain only project-authored images.

Asset replacement does not require deleting or re-pairing devices. Existing
Homey icon overrides/cache and final rendering still require inspection after a
separately authorized installation; the documented SDK does not provide a device
icon setter. No external publication or installation follows from this change.

References: [Homey driver image/icon guidelines](https://apps.developer.homey.app/app-store/guidelines),
[pairing icon paths](https://apps.developer.homey.app/the-basics/devices/pairing#device-pairing-data),
the source links exported from the three geometry modules, and the pinned
license review linked above.
