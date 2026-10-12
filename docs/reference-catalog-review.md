# Homematic(IP) Local comparison — 0.1.10

Review date: 2026-10-12. This is a model/function audit, not a claim of hardware
certification or complete Home Assistant feature parity.

## Reference revisions and method

- Homematic(IP) Local: `ec9577fd2fd2912630dc7a353e6e87615b89b76a`
  (<https://github.com/sukramj/homematicip_local>).
- aiohomematic: `8b8c5459f1d263d9dc248892532079b8cb73e7cc`
  (<https://github.com/sukramj/aiohomematic>), especially custom cover, light,
  siren, text-display and climate profiles, visibility and button rules.
- pydevccu: `6fe7695f049219c77cbda2b60131fdf61d836000`
  (<https://github.com/danielperna84/pydevccu>), XML-RPC device/parameter facts.
- OCCU: `d9d7acbb37c29703f71c89cf3c1f62c390ddcfb2`
  (<https://github.com/eq-3/occu>), channel layouts and exact shared-descriptor
  aliases. No jar, XML or manufacturer artwork is shipped.

The recorded reference catalog contains **120 normalized HmIP model names**:
**117 end devices have profiles**, and **3 are infrastructure** (CCU3, HAP,
RFUSB). Normalization merges labels that differ only by a production suffix;
counting raw labels previously produced one extra entry. The audit found
54 previously unprofiled end-device models. Their core functions now have
profiles and reduced, synthetic-identity integration fixtures. The three
forum devices are included in the same 57-model fixture set.

A further 14 model names from the newer reference/manufacturer descriptions
and 62 exact shared-descriptor variants bring this release's additions to
**130 HmIP model names**, plus **two classic Homematic models**. These are not
130 new independent hardware implementations: many share an existing family.
The supported function subset and verification level matter more than the count.

Reproduce the recorded-catalog comparison after `npm run build`:

```sh
node scripts/audit-reference-catalog.mjs /path/to/pydevccu
```

The result is checked in as [reference-catalog-audit.json](reference-catalog-audit.json).
Exact alias evidence is in `src/profiles/catalog-aliases.ts`. Do not extend these
lists using a model-name prefix alone. The manufacturer's broader catalog also
contains products absent from these reference recordings; those are **not**
implicitly covered by the 117-model result.

## Functions and deliberate boundaries

| Group                                | Functions exposed in this release                                                                                       | Boundaries                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| HM-SCI-3-FM                          | Three contact states and battery alarm in one device                                                                    | Optional BidCos-RF must be enabled; contacts are always read-only                                                         |
| HM-Sec-Sir-WM                        | Separate perimeter/interior/panic commands, four arming states, tamper and battery                                      | Perimeter/interior alarms obey the siren's own arming state; no reinterpretation as optical/acoustic outputs              |
| HmIP-STE2-PCB                        | Probe 1, probe 2 and CCU channel-3 difference in the existing device                                                    | Original capability/identity retained; difference is not calculated in Homey                                              |
| Thermostats/climate                  | Discovered temperature, humidity, setpoint and supported family controls; CO2 where present                             | Wired extended mode/profile enums are not forced into the older radio picker; CL uses four AA batteries                   |
| Floor heating                        | Per-valve feedback, dew-point and emergency alarms                                                                      | No direct valve actuation; CCU heating control remains authoritative                                                      |
| Multi-I/O, switches, dimmers, blinds | Physical outputs, separate feedback/command channels, configurable contacts/buttons, analog voltage                     | No virtual link-channel duplicates; missing/non-writable commands are omitted                                             |
| Motion/presence and environment      | Motion, light, rain, vibration, power-failure, PM1/PM2.5/PM10 and other primary readings                                | SRD heater is read-only; advanced calibration and detection configuration stay in CCU                                     |
| ESI                                  | Power, energy channels 2–4, gas volume/flow                                                                             | CCU reports which sensor is attached; unused sensor-family readings may remain unavailable; no calibration/reset commands |
| DLP/DLS                              | DLP lock/unlock and door state; DLS read-only unknown/locked/unlocked                                                   | DLS is never exposed as a lock actuator; latch-opening and permission management stay in CCU                              |
| Keypads/remotes                      | Button event tokens; WKP uses channel 1–16 with `lock`/`unlock` event type; FWI exposes access-state channels and relay | No PIN/fingerprint enrollment or authorization changes; WKP user index is `ceil(channel / 2)`                             |
| BSL/WRC6/MP3 LEDs                    | Level and eight named signal colours, Flow colour selection                                                             | Vendor animation/playlist configuration stays in CCU                                                                      |
| WRCD                                 | Five display lines through Flow, atomic text/line/commit command                                                        | 0–16 printable ASCII characters; black on white, left aligned, no icon or acoustic notification selection                 |
| MP3P                                 | File 0–252, playback Flow, stop, volume and LED                                                                         | Playback Flow starts a 10-second sound at 50%; playlists/repetition/ramp options are not implemented                      |
| LSC                                  | On/off, level, hue and saturation                                                                                       | Colour-temperature conversion and effect controls remain pending                                                          |

Native Homey capability cards/tags supplement the explicit arming, alarm-channel,
colour, display and sound cards. Existing generic parent devices remain usable
when a model gains logical outputs; adding the new logical devices requires
pairing those outputs. The STE2 update does not require re-pairing.

## Verification

Tests exercise discovery, actual described writable receivers, missing-command
filtering, immutable read-only sensors, classic alarm routing, atomic display/
sound writes, keypad event maps and in-place STE2 migration/callback routing.
Descriptor-only additions use independently authored synthetic channel tests;
shared aliases reuse the checked family's channel mapping. New hardware models
have not been physically actuated in this release audit.
