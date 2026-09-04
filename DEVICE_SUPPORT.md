# Device support

OpenCCU discovery is always the source of truth. Known products are routed to a dedicated Homey driver backed by shared typed profiles; unknown products remain pairable through `openccu-generic`.

## Verification levels

- **Hardware verified:** paired and exercised on Homey Pro against OpenCCU.
- **Fixture verified:** profile, routing, read/write targets, build, and Homey manifest are covered locally.
- **Generic only:** safely discovered where possible, but no dedicated product profile exists yet.

## Current dedicated coverage

| Family                 | Product types                                                                                   | Verification                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Contact                | HMIP-SWDO/HmIP-SWDO, HmIP-SWDO-I, HmIP-SWDM                                                     | fixture; individual product drivers                                      |
| Contact                | HmIP-SWDO-2                                                                                     | fixture; hardware available for later re-pairing                         |
| Rotary handle          | HmIP-SRH                                                                                        | fixture; three-state handle position                                     |
| Climate                | HMIP-WTH/HmIP-WTH, HmIP-STH, HmIP-STHD, HmIP-BWTH                                               | fixture; individual product drivers                                      |
| Outdoor climate sensor | HmIP-STHO                                                                                       | fixture; read-only temperature and humidity                              |
| Radiator thermostat    | HMIP-eTRV/HmIP-eTRV, HmIP-eTRV-2, HmIP-eTRV-B, HmIP-eTRV-B-2, HmIP-eTRV-C, HmIP-eTRV-E/E-A      | hardware/fixture; individual product drivers; extended actions pending   |
| Switch                 | HMIP-PS/HmIP-PS, HmIP-PCBS, HmIP-PCBS-BAT, HmIP-DRSI1, HmIP-FSI, HmIP-FS6, HmIP-USBSM, HmIP-WGC | fixture; individual product drivers; standard on/off subset              |
| Multi-output switch    | HmIP-DRSI4, HmIP-MOD-OC8, HmIP-PCBS2, HmIP-BS2, HmIP-WHS2                                       | fixture; one Homey device per output                                     |
| Dimmer                 | HmIP-BDT, HmIP-FDT, HmIP-PDT, HmIP-DRDI3                                                        | fixture; on/off plus level; DRDI3 split into three outputs               |
| Power-meter switch     | HMIP-PSM, HmIP-PSM, HmIP-BSM, HmIP-FSM, HmIP-FSM16                                              | fixture; BSM includes both local button channels                         |
| Cover                  | HmIP-BROLL, HmIP-FROLL                                                                          | fixture; position and explicit up/down/stop                              |
| Blind                  | HmIP-FBL, HmIP-BBL                                                                              | fixture; position, explicit up/down/stop, and slat position              |
| Door lock              | HmIP-DLD                                                                                        | fixture; native Homey lock/unlock; latch-open action pending             |
| Garage door            | HmIP-MOD-HO, HmIP-MOD-TM                                                                        | fixture; native open/close; stop and ventilation actions pending         |
| Weather sensor         | HmIP-SWO-PR                                                                                     | fixture; standard temperature/humidity/luminance subset                  |
| Light sensor           | HmIP-SLO                                                                                        | fixture; current illuminance subset                                      |
| Temperature sensor     | HmIP-STE2-PCB                                                                                   | fixture; first probe only                                                |
| Motion sensor          | HmIP-SMI, HmIP-SMI55, HmIP-SMO-A                                                                | fixture; SMI55 motion and button events                                  |
| Presence sensor        | HmIP-SPI                                                                                        | fixture; exposed through Homey motion alarm                              |
| Acceleration sensor    | HmIP-SAM                                                                                        | fixture; exposed through Homey motion alarm                              |
| Water sensor           | HmIP-SWD                                                                                        | fixture; current and legacy datapoint variants                           |
| Smoke detector         | HmIP-SWSD                                                                                       | fixture; smoke alarm and optional intrusion-siren control                |
| Siren                  | HmIP-ASIR                                                                                       | fixture; atomic acoustic/optical 30-second default alarm                 |
| Irrigation valve       | HmIP-WSM                                                                                        | fixture; neutral Homey class, on/off valve control; flow metrics pending |
| Buttons/remotes        | HmIP-BRC2, HMIP-WRC2/HmIP-WRC2, HmIP-WRC6, HmIP-RC8                                             | fixture; short/long press device Flow trigger                            |

## Reference baseline

- `homey-matic` upstream Git history: legacy product presentation and mappings.
- `aiohomematic` commit `146ccec9ccc1da867c1de709dc815649728aca72`: domain/profile behavior reference.
- `homematicip_local` commit `761b0eb24d23223c86215ac440f759191262489d`: Home Assistant adapter and entity-boundary reference.

Both external references are MIT licensed. Concepts and datapoint semantics are independently adapted to strict TypeScript; Python is not included at runtime.

## Next batches

1. Extended weather sensors.
2. Enhanced covers/blinds, locks, siren/valve options, combined devices, and RGBW/DALI lighting.
3. Add redacted OpenCCU fixtures and promote devices to hardware verified as equipment becomes available.
