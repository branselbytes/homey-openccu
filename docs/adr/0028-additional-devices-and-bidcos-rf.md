# ADR 0028: Additional device profiles and optional BidCos-RF

- Status: accepted, implemented in 0.1.8 beta
- Date: 2026-10-10

## Context and references

[Community post 8](https://community.homey.app/t/app-pro-homematic-ip-local-openccu/160314/8) requests HmIP-BROLL-2, HmIP-SWDO-2, HmIP-FALMOT-C12, HmIP-MIOB and HM-PB-2-FM. SWDO-2 already belongs to the optical-contact family. Exact model matching requires an explicit BROLL-2 alias. The classic button requires BidCos-RF transport, not the HmIP-RF endpoint.

The following sources were consulted as design references. No external implementation, manufacturer XML, jar or artwork is packaged or copied into this repository:

- Original MIT `homey-matic`, imported commit `e7a16bb12dca80bad04e0527870f5a64ed03ef28`: HM-PB-2-FM channels 1/2 and PRESS_SHORT/PRESS_LONG events; existing BROLL driver.
- [aiohomematic](https://github.com/SukramJ/aiohomematic), `8b8c5459f1d263d9dc248892532079b8cb73e7cc`: cover channel separation and generic read-only valve sensors.
- [homematicip_local](https://github.com/SukramJ/homematicip_local), `c549b94aa64036e36f18cef1215f8dc610936ae2`: FALMOT LEVEL is a sensor, not a thermostat setpoint.
- [pydevccu](https://github.com/SukramJ/pydevccu), `6fe7695f049219c77cbda2b60131fdf61d836000`: FALMOT-C12 and HM-PB-2-FM XML-RPC metadata facts (MIT, copyright 2019–2026 Daniel Perna, SukramJ and contributors).
- [eQ-3 OCCU](https://github.com/eq-3/occu/tree/d9d7acbb37c29703f71c89cf3c1f62c390ddcfb2), `HMserver/opt/HMServer/HMIPServer.jar`: `device_broll.xml` explicitly lists BROLL and BROLL-2 together; `device_miob.xml` and its channel type specifications establish MIOB physical readback channels 1/5, virtual receivers 2/6, digital inputs 9/10 and analog output 11. Manufacturer material was inspected only for protocol facts.

## Decision

Use shared profile/discovery/runtime adapters and synthetic, project-authored protocol fixtures. Profiles consult the discovered parameter operations and never invent writable targets. A profile-level `readOnly` constraint additionally prevents sensor controls even if a future firmware advertises broader operation bits.

- BROLL-2 uses the existing BROLL driver: read channel 3, write channel 4, explicit STOP.
- SWDO-2 remains in the existing SWDO family.
- FALMOT-C12 offers twelve selectable logical valve devices, with percentage opening, dew-point alarm and emergency-operation status. These are read-only. Heating setpoints remain on the associated thermostat/heating group. Central heating/cooling mode, valve-error enum and link configuration are outside this initial profile.
- MIOB offers two physical switch outputs (1 → 2, 5 → 6), two read-only digital input STATE signals (9/10) and one analog output LEVEL (11, Homey dim 0–100%). Extra virtual receiver channels are not duplicate devices. The analog value is normalized level, not measured volts. CCU input/output modes, voltage range and direct links remain configured in OpenCCU; mode-specific input datapoints and weekly schedules are not exposed here. Missing/unwritable control targets are omitted.
- HM-PB-2-FM uses the existing button Flow with button number and short/long type, plus LOWBAT. No button ACTION parameter is written.

BidCos-RF is explicitly opt-in per central. Defaults are XML-RPC port 2001 and callback port 12012 (primary callback + 2); HmIP-RF and VirtualDevices retain their endpoints. It has its own client queue, discovery, callback, retry supervisor and shutdown, reusing the common implementations. HmIP remains healthy if classic discovery is offline. Names still come from the central's JSON-RPC metadata. Diagnostics include the additional interfaces under their central.

Settings reload releases the previous runtime before rebinding its callback ports. Configuration validation runs before stopping anything; if replacement startup fails, that central stays stopped until a successful reload. Startup failure cleans up callback servers. No silent endpoint probing or CCU configuration changes are introduced.

## Validation and limits

Synthetic XML-RPC integration covers discovery, stable pairing identities, precise command targets, read-only rejection, initial sensor reads and classic callbacks through the production Homey binding controller. Factory tests cover opt-in/out, independent failure, deregistration and cleanup; lifecycle tests cover callback-port reuse. These are not hardware tests: pairing, actual MIOB firmware/mode behavior and physical event delivery must still be exercised on the requested devices before claiming hardware verification.

After a successful settings reload, the Homey adapter rebinds paired physical and system devices to the replacement runtime. Reload and rebind operations are serialized; shutdown drains them before stopping the central.

Previously paired generic parent devices retain generic mapping when a new profile introduces logical channels. They are not silently assigned to a particular output; users may choose the new per-output devices explicitly.

## Local verification record

- `npm run check`: passed formatting, ESLint, both TypeScript projects and 736 tests across 75 files.
- Homey CLI `App.preprocess()` and `App._validate({ level: "publish" })`: passed; generated manifest refreshed. This validates packaging, not publication.
- Additional changed TypeScript modules were explicitly formatted with Prettier; `git diff --check` passed.
- XML-RPC fixtures exercised production discovery/binding/write paths. Callback binding failure was tested with an occupied local TCP port.
- No physical device test, Homey deployment, release, GitHub push or external CCU change was performed for this implementation.
