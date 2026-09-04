# Device support

OpenCCU discovery is always the source of truth. Known products are routed to a dedicated Homey driver backed by shared typed profiles; unknown products remain pairable through `openccu-generic`.

## Verification levels

- **Hardware verified:** paired and exercised on Homey Pro against OpenCCU.
- **Fixture verified:** profile, routing, read/write targets, build, and Homey manifest are covered locally.
- **Generic only:** safely discovered where possible, but no dedicated product profile exists yet.

## Current dedicated coverage

| Family                 | Product types                                                                              | Verification                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Contact                | HMIP-SWDO/HmIP-SWDO, HmIP-SWDO-I, HmIP-SWDM                                                | fixture; individual product drivers                                    |
| Contact                | HmIP-SWDO-2                                                                                | fixture; hardware available for later re-pairing                       |
| Rotary handle          | HmIP-SRH                                                                                   | fixture; three-state handle position                                   |
| Climate                | HMIP-WTH/HmIP-WTH, HmIP-STH, HmIP-STHD, HmIP-BWTH                                          | fixture; individual product drivers                                    |
| Outdoor climate sensor | HmIP-STHO                                                                                  | fixture; read-only temperature and humidity                            |
| Radiator thermostat    | HMIP-eTRV/HmIP-eTRV, HmIP-eTRV-2, HmIP-eTRV-B, HmIP-eTRV-B-2, HmIP-eTRV-C, HmIP-eTRV-E/E-A | hardware/fixture; individual product drivers; extended actions pending |
| Switch                 | HMIP-PS/HmIP-PS, HmIP-PCBS, HmIP-PCBS-BAT, HmIP-DRSI1                                      | fixture; individual product drivers                                    |
| Power-meter switch     | HMIP-PSM, HmIP-PSM                                                                         | fixture                                                                |
| Cover                  | HmIP-BROLL, HmIP-FROLL, HmIP-FBL                                                           | fixture; individual product drivers; slat semantics pending            |
| Weather sensor         | HmIP-SWO-PR                                                                                | fixture; standard temperature/humidity/luminance subset                |
| Light sensor           | HmIP-SLO                                                                                   | fixture; current illuminance subset                                    |
| Temperature sensor     | HmIP-STE2-PCB                                                                              | fixture; first probe only                                              |

## Reference baseline

- `homey-matic` upstream Git history: legacy product presentation and mappings.
- `aiohomematic` commit `146ccec9ccc1da867c1de709dc815649728aca72`: domain/profile behavior reference.
- `homematicip_local` commit `761b0eb24d23223c86215ac440f759191262489d`: Home Assistant adapter and entity-boundary reference.

Both external references are MIT licensed. Concepts and datapoint semantics are independently adapted to strict TypeScript; Python is not included at runtime.

## Next batches

1. Motion, presence, smoke, water, and extended weather sensors.
2. Buttons/remotes and stateless event Flow triggers.
3. Multi-channel switches, dimmers, enhanced covers/blinds, locks, sirens, valves, and RGBW/DALI lighting.
4. Add redacted OpenCCU fixtures and promote devices to hardware verified as equipment becomes available.
