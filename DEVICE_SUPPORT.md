# Device support

OpenCCU discovery is always the source of truth. Known products are routed to a dedicated product or family Homey driver backed by shared typed profiles; unknown products remain pairable through `openccu-generic`.

## Verification levels

- **Hardware verified:** paired and exercised on Homey Pro against OpenCCU.
- **Fixture verified:** profile, routing, read/write targets, build, and Homey manifest are covered locally.
- **Generic only:** safely discovered where possible, but no dedicated product profile exists yet.

## Current dedicated coverage

| Family                 | Product types                                                                                              | Verification                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| OpenCCU system         | One device per configured central                                                                          | fixture; live pairing and metric verification pending                                                |
| Optical contact        | HMIP-SWDO/HmIP-SWDO, HmIP-SWDO-2, HmIP-SWDO-I, HmIP-SWDO-A                                                 | synthetic fixture; shared driver; live SWDO-A discovery verified; physical events pending            |
| Contact                | HmIP-SWDM, HmIP-SCI, HmIP-FCI1                                                                             | fixture; FCI1 follows discovered contact/button datapoints                                           |
| Rotary handle          | HmIP-SRH                                                                                                   | fixture; three-state handle position                                                                 |
| Climate                | HMIP-WTH/HmIP-WTH, HmIP-STH, HmIP-STHD, HmIP-BWTH                                                          | fixture; individual product drivers                                                                  |
| Heating group          | HmIP-HEATING on OpenCCU VirtualDevices                                                                     | fixture; temperature, humidity, setpoint, mode, boost, week profile; live verification pending       |
| Outdoor climate sensor | HmIP-STHO                                                                                                  | fixture; read-only temperature and humidity                                                          |
| Radiator thermostat    | HMIP-eTRV/HmIP-eTRV, HmIP-eTRV-2, HmIP-eTRV-B, HmIP-eTRV-B-2, HmIP-eTRV-C, HmIP-eTRV-E/E-A                 | hardware/recorded fixture; shared eTRV pairing in 0.1.8 beta code; command hardware checks remain    |
| Switch                 | HMIP-PS/HmIP-PS, HmIP-PCBS, HmIP-PCBS-BAT, HmIP-DRSI1, HmIP-FSI/FSI6/FSI16, HmIP-FS6, HmIP-USBSM, HmIP-WGC | fixture; PS shares the plug family in 0.1.8 beta code; other devices retain individual drivers       |
| Multi-output switch    | HmIP-DRSI4, HmIP-MOD-OC8, HmIP-PCBS2, HmIP-BS2, HmIP-WHS2                                                  | fixture; one Homey device per output                                                                 |
| Dimmer                 | HmIP-BDT, HmIP-FDT, HmIP-PDT, HmIP-DRDI3                                                                   | fixture; on/off plus level; DRDI3 split into three outputs                                           |
| DALI gateway           | HmIP-DRG-DALI                                                                                              | fixture; discovered outputs 1–48; level, hue, and saturation subset                                  |
| RGBW controller        | HmIP-RGBW                                                                                                  | fixture; mode-aware logical outputs; level and RGB hue/saturation                                    |
| Power-meter switch     | HMIP-PSM, HmIP-PSM, HmIP-BSM, HmIP-FSM, HmIP-FSM16                                                         | fixture; BSM includes both local button channels                                                     |
| Cover                  | HmIP-BROLL, HmIP-BROLL-2, HmIP-FROLL                                                                       | fixture; position and explicit up/down/stop                                                          |
| Blind                  | HmIP-FBL, HmIP-BBL                                                                                         | fixture; position, explicit up/down/stop, and slat position                                          |
| Door lock              | HmIP-DLD                                                                                                   | fixture; native Homey lock/unlock; latch-open action pending                                         |
| Garage door            | HmIP-MOD-HO, HmIP-MOD-TM                                                                                   | fixture; native open/close; MOD-HO additionally has stop, ventilation, four-state position and light |
| Weather sensor         | HmIP-SWO-B, HmIP-SWO-PL                                                                                    | fixture; discovery-filtered climate, wind, rain, and sunshine values                                 |
| Weather sensor         | HmIP-SWO-PR                                                                                                | hardware/fixture; live reads and XML-RPC push updates verified                                       |
| Light sensor           | HmIP-SLO                                                                                                   | fixture; current illuminance subset                                                                  |
| Temperature sensor     | HmIP-STE2-PCB                                                                                              | fixture; first probe only                                                                            |
| CO₂ sensor + relay     | HmIP-SCTH230                                                                                               | fixture; CO₂, temperature, humidity, relay; indicator LED pending                                    |
| Motion sensor          | HmIP-SMI, HmIP-SMI55, HmIP-SMO-A                                                                           | fixture; optional detection enable switch; SMI55 detection on channel 3; live retest pending         |
| Presence sensor        | HmIP-SPI                                                                                                   | fixture; Homey motion alarm and optional detection enable switch                                     |
| Acceleration sensor    | HmIP-SAM                                                                                                   | fixture; exposed through Homey motion alarm                                                          |
| Water sensor           | HmIP-SWD                                                                                                   | fixture; current and legacy datapoint variants                                                       |
| Smoke detector         | HmIP-SWSD                                                                                                  | fixture; smoke alarm and optional intrusion-siren control                                            |
| Siren                  | HmIP-ASIR                                                                                                  | fixture; atomic acoustic/optical 30-second default alarm                                             |
| Irrigation valve       | HmIP-WSM                                                                                                   | fixture; on/off, L/min flow, and cumulative m³; neutral Homey class                                  |
| Buttons/remotes        | HmIP-BRA, HmIP-BRC2, HMIP-WRC2/HmIP-WRC2, HmIP-WRC6, HmIP-RC8                                              | fixture; short/long press device Flow trigger                                                        |

## Unreleased catalog additions

### HmIP-MOD-HO issue #1 follow-up

Firmware 1.0.16 metadata from the [submitted diagnostic report](https://github.com/branselbytes/homey-openccu/issues/1) verifies channel 1 `DOOR_COMMAND`/`DOOR_STATE` and channel 2 boolean light `STATE`. The 0.1.8 beta profile adds native open/stop/close buttons, ventilation and a read-only closed/open/ventilation/unknown position. Flow actions cover commands and ventilation; a condition checks the detailed reported state. Previously paired devices retain their IDs and existing garage/light capabilities and gain the controls after app initialization, without re-pairing.

Both numeric and symbolic unknown positions are supported. Unknown clears the native closed-state reading instead of treating it as closed or interrupting the rest of a callback batch. Motor commands remain explicit string enum values as in the current Home Assistant reference; the light target was already correct. The outgoing `setValue` rejection reported for both controls is not yet proven resolved: the new safe fault-code diagnostics provide the missing evidence. Hardware commands and native Homey UI checks are still pending.

The recording is anonymized and exercised with synthetic values, command acknowledgements and callbacks. Source revisions, enum serialization findings and the decision to avoid a simulated percentage position are recorded in [ADR 0023](docs/adr/0023-hoermann-controls-and-support-diagnostics.md). MOD-TM retains its previous open/close mapping.

### Earlier catalog additions

The running 0.1.2 installation remains the deployed baseline. The following additions are prepared locally:

| Family                 | Models                   | Evidence and behavior                                                                                                                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PSM switch/meter plugs | HmIP-PSM-2, HmIP-PSM-2-A | PSM-2 descriptions recorded from OpenCCU; feedback STATE on channel 2, commands on channel 3, metering on channel 6, optional internal temperature on channel 0 and button events on channel 1. The anthracite variant is a fixture-tested model alias; CCU currently reports the sampled PSM-2 unreachable; live reads and physical switching remain unverified. |
| Wired climate sensors  | HmIPW-STH, HmIPW-STH-A   | STH-A descriptions recorded from OpenCCU; channel 1 temperature, humidity, setpoint and boost. Modes 0–3 and week profiles 1–6 need complete Homey mappings and are deferred. STH is a fixture-tested model alias; physical command execution remains unverified.                                                                                                 |

The manufacturer documents each pair together in the [PSM-2/-2-A manual](https://homematic-ip.com/sites/default/files/downloads/157337a0_161599a0_hmip-psm-2_um_e.pdf) and [Wired STH/-A datasheet](https://homematic-ip.com/sites/default/files/downloads/153687a0_160536a0_hmipw-sth_datasheet_e.pdf). Capabilities still depend on discovered datapoints; the variant aliases do not imply hardware verification of both colors.

Existing generically paired devices keep their IDs and existing capabilities. PSM-2 retains its internal temperature reading and gains switching; Wired STH retains its existing climate controls and gains the discovered boost control. New dedicated pairing entries exclude matching devices already paired generically. These changes use the existing initialization-time binding reconciliation and do not require deleting devices.

## Plug family and device pictures (0.1.8 beta)

PS and PSM plug-in switches share the **HmIP Schalt- und Messsteckdosen / HmIP switch and meter plugs** entry. The PS, PSM and PSM-2/-2-A profiles keep their original channels, capabilities and conversions; the PS remains switch-only. Existing devices retain their IDs and drivers. The old HMIP-PS driver is retained but hidden from new pairing, and already paired PS/generic devices are excluded from the shared entry.

PDT is a plug dimmer and remains separate. USB switches, circuit boards, flush-mounted and DIN-rail actuators also retain distinct entries; their previously reused socket images were incorrect. Each driver now references its own product drawings. Where no imported product artwork exists, project-authored schematic drawings represent the device form and function.

The subsequent 0.1.8 beta artwork review redraws all 32 project-authored drivers and two additional family variants with finer perspective lines and corrected product silhouettes. It fixes the MOD-TM enclosure, USBSM PCB, vertical basic/Evo thermostats, narrow SWDO-2/A contacts, lock controls and weather assemblies. Inherited images and all pairing paths remain intact. The old `HmIP-FSI` family name uses the FSI16 enclosure conservatively because a separate physical variant was not established. See [ADR 0024](docs/adr/0024-refined-device-illustrations.md) and the [before/after examples](docs/design/device-artwork-comparison.png).

Shared socket, SWDO and eTRV families select model-specific SVG icons at pairing. These are monochrome drawings, so housing color variants can intentionally share an icon. Existing stored per-device icon overrides are retained; selecting a new variant icon for an already paired device is not exposed by the documented Homey Device API. No automatic deletion/re-pairing or identity migration is performed. Post-update Homey display/cache checks remain pending.

## eTRV family (0.1.8 beta)

The existing `HmIP-eTRV-2` driver is the single new-pairing entry **HmIP-eTRV Heizkörperthermostate / HmIP-eTRV radiator thermostats**. All listed eTRV variants already use identical bindings; the consolidation changes their pairing destination, not their read/write targets or Flow capabilities. The old HMIP-eTRV, B, B-2, C and E drivers remain packaged as deprecated adapters. Existing IDs and Flows are retained, with duplicate pairing excluded across legacy and generic drivers.

Recorded descriptions for eTRV-2 I9F, eTRV-B-2 R4M and eTRV-E-A cover shared routing and unchanged bindings. Read-only checks against all three models returned 18 mapped values successfully. Values, callbacks and commands in these regression tests are simulated; live heater commands were not sent. Weather models remain separate because the pro profile adds a compass capability; contact-input modules with button events likewise retain their own profiles.

## SWDO family

New contacts are added through **HmIP-SWDO window / door contacts** (German: **HmIP-SWDO Fenster-/Türkontakte**). The explicit model list covers SWDO, SWDO-2, SWDO-I, and SWDO-A, including the original uppercase HMIP-SWDO and HMIP-SWDO-A spellings. OpenCCU model suffixes separated by whitespace are normalized as before. Other SWDO variants remain on the generic discovery path until explicitly verified.

The shared profile exposes the discovered channel 1 `STATE` as `alarm_contact` and channel 0 `LOW_BAT` as `alarm_battery`. The manufacturer lists SWDO-2 and SWDO-A together in the [operating manual](https://homematic-ip.com/sites/default/files/downloads/157857a0_160027a0_hmip-swdo-2_um.pdf). Discovery still gates each capability. A dedicated synthetic XML-RPC fixture covers initial reads and callbacks; the 0.1.8 beta test suite additionally verifies recorded descriptions for HMIP-SWDO, SWDO-2 and SWDO-A. Following installation of 0.1.2 on Homey Christian (Homey 13.5.0, 2026-10-03), live discovery additionally confirmed HMIP-SWDO, HmIP-SWDO-2 and HmIP-SWDO-A on the shared profile with both capabilities and zero discovery issues.

Existing SWDO-2 and SWDO-I devices retain their original Homey driver, identity, capabilities, and Flows. Their driver entries are deprecated and hidden from new pairing, but still shipped. Contacts already paired through those drivers or the generic driver are omitted from the shared SWDO pairing list. There is no automatic deletion or re-pairing. The 0.1.2 upgrade preserved all 13 existing Homey device identities and capabilities, with every device available after installation. Live SWDO-A pairing, opening/closing and battery-state verification remain pending.

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
- **HmIPW-SPI:** presence via alarm_motion, illuminance and a discovery-checked detection enable switch; four units found on the test OpenCCU. Recorded descriptions and simulated callback routing verified; hardware presence changes pending.
- **HmIP-BRC2:** existing driver confirmed against the live device description; both buttons support short/long Flow events. This unit exposes no battery datapoint. Recorded callback tests verified; physical button events pending.

HmIP-SWO-PR additionally displays a derived eight-point wind direction (German Nord, Nordost, Ost, Südost, Süd, Südwest, West, Nordwest). The original degree value remains available. The new capability is added to existing devices on app startup without re-pairing and follows the same wind-direction events.

### Motion and presence detection enable

HmIP-SMI, HmIP-SMI55, HmIP-SMO-A, HmIP-SPI and HmIPW-SPI expose **Detection active / Erkennung aktiv** in the Homey device controls when the CCU describes the corresponding VALUES datapoint as writable. It writes MOTION_DETECTION_ACTIVE (motion) or PRESENCE_DETECTION_ACTIVE (presence), reads the current setting and follows CCU callbacks. The SMI55 uses detection channel 3; its button channels 1/2 remain independent. Other listed detectors use channel 1. Unsupported firmware does not receive a nonfunctional control.

Existing paired devices gain the capability during initialization after an app restart and successful discovery; re-pairing is not required. A later firmware change that adds a writable datapoint requires another app restart. The motion alarm remains a separate CCU reading: disabling detection does not synthesize an alarm-clear or reset command. Profile and recorded Wired fixtures cover mapping, startup migration, writes and callbacks; live switching and battery-device timing still need hardware verification.

Post-install verification on Homey Christian: existing HmIP-SMI and HmIPW-SPI devices both gained the control automatically and returned an active detection state. This verifies discovery, migration and initial reads, not live switching. The datapoint semantics and SMI55 channel assignment were cross-checked against the [FHEM HMCCU device definitions](https://github.com/mhop/fhem-mirror/blob/master/fhem/FHEM/HMCCUConf.pm); the Wired mapping additionally uses this repository's recorded CCU description.

## Newly implemented, 0.1.8 beta profiles

- **HM-PB-2-FM:** optional BidCos-RF; two buttons with short/long press Flow tokens, LOWBAT. Enable classic Homematic in app settings first.
- **HmIP-FALMOT-C12:** twelve selectable read-only valve devices with opening percentage, dew-point alarm and emergency operation. Set temperature through the linked thermostat or heating group.
- **HmIP-MIOB:** two relay outputs, two digital input STATE signals, analog LEVEL output. Native switch/dim/contact Flow cards apply to the corresponding named device. Input/output operating modes and direct links stay in OpenCCU.
- **HmIP-BROLL-2:** existing BROLL family, position and up/down/stop.
- **HmIP-SWDO-2:** already supported; additional regression fixture.

All five are covered by synthetic fixtures; the newly added models are not hardware verified. See [ADR 0028](docs/adr/0028-additional-devices-and-bidcos-rf.md) for exact scope, protocol sources and limitations.
