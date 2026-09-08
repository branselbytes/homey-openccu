# Device support

OpenCCU discovery is always the source of truth. Known products are routed to a dedicated Homey driver backed by shared typed profiles; unknown products remain pairable through `openccu-generic`.

## Verification levels

- **Hardware verified:** paired and exercised on Homey Pro against OpenCCU.
- **Fixture verified:** profile, routing, read/write targets, build, and Homey manifest are covered locally.
- **Generic only:** safely discovered where possible, but no dedicated product profile exists yet.

## Current dedicated coverage

| Family                 | Product types                                                                                              | Verification                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| OpenCCU system         | One device per configured central                                                                          | fixture; live pairing and metric verification pending                                          |
| Contact                | HMIP-SWDO/HmIP-SWDO, HmIP-SWDO-I, HmIP-SWDM, HmIP-SCI, HmIP-FCI1                                           | fixture; FCI1 follows discovered contact/button datapoints                                     |
| Contact                | HmIP-SWDO-2                                                                                                | fixture; hardware available for later re-pairing                                               |
| Rotary handle          | HmIP-SRH                                                                                                   | fixture; three-state handle position                                                           |
| Climate                | HMIP-WTH/HmIP-WTH, HmIP-STH, HmIP-STHD, HmIP-BWTH                                                          | fixture; individual product drivers                                                            |
| Heating group          | HmIP-HEATING on OpenCCU VirtualDevices                                                                     | fixture; temperature, humidity, setpoint, mode, boost, week profile; live verification pending |
| Outdoor climate sensor | HmIP-STHO                                                                                                  | fixture; read-only temperature and humidity                                                    |
| Radiator thermostat    | HMIP-eTRV/HmIP-eTRV, HmIP-eTRV-2, HmIP-eTRV-B, HmIP-eTRV-B-2, HmIP-eTRV-C, HmIP-eTRV-E/E-A                 | hardware/fixture; individual product drivers; extended actions pending                         |
| Switch                 | HMIP-PS/HmIP-PS, HmIP-PCBS, HmIP-PCBS-BAT, HmIP-DRSI1, HmIP-FSI/FSI6/FSI16, HmIP-FS6, HmIP-USBSM, HmIP-WGC | fixture; individual product drivers; standard on/off subset                                    |
| Multi-output switch    | HmIP-DRSI4, HmIP-MOD-OC8, HmIP-PCBS2, HmIP-BS2, HmIP-WHS2                                                  | fixture; one Homey device per output                                                           |
| Dimmer                 | HmIP-BDT, HmIP-FDT, HmIP-PDT, HmIP-DRDI3                                                                   | fixture; on/off plus level; DRDI3 split into three outputs                                     |
| DALI gateway           | HmIP-DRG-DALI                                                                                              | fixture; discovered outputs 1–48; level, hue, and saturation subset                            |
| RGBW controller        | HmIP-RGBW                                                                                                  | fixture; mode-aware logical outputs; level and RGB hue/saturation                              |
| Power-meter switch     | HMIP-PSM, HmIP-PSM, HmIP-BSM, HmIP-FSM, HmIP-FSM16                                                         | fixture; BSM includes both local button channels                                               |
| Cover                  | HmIP-BROLL, HmIP-FROLL                                                                                     | fixture; position and explicit up/down/stop                                                    |
| Blind                  | HmIP-FBL, HmIP-BBL                                                                                         | fixture; position, explicit up/down/stop, and slat position                                    |
| Door lock              | HmIP-DLD                                                                                                   | fixture; native Homey lock/unlock; latch-open action pending                                   |
| Garage door            | HmIP-MOD-HO, HmIP-MOD-TM                                                                                   | fixture; native open/close; stop and ventilation actions pending                               |
| Weather sensor         | HmIP-SWO-B, HmIP-SWO-PL                                                                                    | fixture; discovery-filtered climate, wind, rain, and sunshine values                           |
| Weather sensor         | HmIP-SWO-PR                                                                                                | hardware/fixture; live reads and XML-RPC push updates verified                                 |
| Light sensor           | HmIP-SLO                                                                                                   | fixture; current illuminance subset                                                            |
| Temperature sensor     | HmIP-STE2-PCB                                                                                              | fixture; first probe only                                                                      |
| CO₂ sensor + relay     | HmIP-SCTH230                                                                                               | fixture; CO₂, temperature, humidity, relay; indicator LED pending                              |
| Motion sensor          | HmIP-SMI, HmIP-SMI55, HmIP-SMO-A                                                                           | fixture; model-specific luminance priority; SMI live Lux retest pending                        |
| Presence sensor        | HmIP-SPI                                                                                                   | fixture; exposed through Homey motion alarm                                                    |
| Acceleration sensor    | HmIP-SAM                                                                                                   | fixture; exposed through Homey motion alarm                                                    |
| Water sensor           | HmIP-SWD                                                                                                   | fixture; current and legacy datapoint variants                                                 |
| Smoke detector         | HmIP-SWSD                                                                                                  | fixture; smoke alarm and optional intrusion-siren control                                      |
| Siren                  | HmIP-ASIR                                                                                                  | fixture; atomic acoustic/optical 30-second default alarm                                       |
| Irrigation valve       | HmIP-WSM                                                                                                   | fixture; on/off, L/min flow, and cumulative m³; neutral Homey class                            |
| Buttons/remotes        | HmIP-BRA, HmIP-BRC2, HMIP-WRC2/HmIP-WRC2, HmIP-WRC6, HmIP-RC8                                              | fixture; short/long press device Flow trigger                                                  |

## Reference baseline

- `homey-matic` upstream Git history: legacy product presentation and mappings.
- `aiohomematic` commit `146ccec9ccc1da867c1de709dc815649728aca72`: domain/profile behavior reference.
- `homematicip_local` commit `761b0eb24d23223c86215ac440f759191262489d`: Home Assistant adapter and entity-boundary reference.

Both external references are MIT licensed. Concepts and datapoint semantics are independently adapted to strict TypeScript; Python is not included at runtime.

## Hardware matrix

Hardware results describe only the exercised functions, not blanket support for every datapoint or firmware version. Device serial numbers and credentials are deliberately omitted.

| Date       | Homey environment              | OpenCCU interface | Product       | Pairing | Initial reads | Commands                | Push events | Restart/reconnect | Remaining checks                         |
| ---------- | ------------------------------ | ----------------- | ------------- | ------- | ------------- | ----------------------- | ----------- | ----------------- | ---------------------------------------- |
| 2026-09-05 | Homey Pro gen. 2, Homey 13.4.1 | HmIP-RF           | HmIP-SWO-PR   | pass    | pass          | n/a                     | pass        | pass              | OpenCCU outage, deletion and re-pairing  |
| earlier    | Homey Test                     | HmIP-RF           | HmIP-eTRV-B-2 | pass    | pass          | target temperature pass | pass        | pass              | mode, boost, week profile, valve, delete |

For the HmIP-SWO-PR run, all nine discovered capabilities were populated: temperature, humidity, illuminance, wind strength, wind angle, rain state, cumulative rain, sunshine duration, and battery alarm. Illuminance and wind strength changed again after the initial read while the app remained healthy, demonstrating callback delivery through the live XML-RPC event path. After a targeted app restart, the runtime returned to its healthy state in about three seconds, the device remained available, and subsequent values proved that the callback was registered again. The cumulative metrics retain their OpenCCU units (`mm` and `min`).

## Next batches

1. Enhanced covers/blinds, locks, siren/valve options, and combined devices.
2. Add metadata-normalized light color temperature.
3. Add redacted OpenCCU fixtures and promote devices to hardware verified as equipment becomes available.

## Wired multi-channel devices

- **HmIPW-DRS8:** eight logical output devices; feedback channels 1/5/9/13/17/21/25/29, first virtual command channels 2/6/10/14/18/22/26/30. Descriptions and state reads verified live; commands verified with a recorded fixture. The user confirmed physical output switching on Homey Test on 2026-09-08.
- **HmIPW-DRI16:** channels 1–16 independently follow MASTER CHANNEL_OPERATION_MODE. Binary inputs expose contact state and native Homey alarm-contact Flow cards; key/switch modes expose the existing button Flow trigger with channel and short/long tokens. Inactive/unknown modes have no active mapping. Live descriptions/configuration reads and recorded-fixture mode transitions verified. The user confirmed the practical tests work on Homey Test on 2026-09-08; individual channels, press variants, and live mode-change scenarios were not itemized.

Changes reported by OpenCCU through updateDevice refresh existing input mappings without re-pairing. Restart the app if a configuration change is not reported. A Flow using a function removed by a mode change may need adjustment.

User acceptance follow-up (2026-09-08): the user confirmed that the DRS8/DRI16 tests work after the pairing investigation. This records user-reported practical success, not exhaustive verification of all channels, input modes, or reconnect scenarios.

## Wired infrastructure and presence

- **HmIPW-DRAP:** temperature, supply voltage, bus 1/2 voltage and current, and eight separate fault/reachability indicators. Read-only profile backed by a recorded device description. No bus control or configuration writes.
- **HmIPW-SPI:** presence via alarm_motion and illuminance; four units found on the test OpenCCU. Recorded descriptions and simulated callback routing verified; hardware presence changes pending.
- **HmIP-BRC2:** existing driver confirmed against the live device description; both buttons support short/long Flow events. This unit exposes no battery datapoint. Recorded callback tests verified; physical button events pending.

HmIP-SWO-PR additionally displays a derived eight-point wind direction (German Nord, Nordost, Ost, Südost, Süd, Südwest, West, Nordwest). The original degree value remains available. The new capability is added to existing devices on app startup without re-pairing and follows the same wind-direction events.
