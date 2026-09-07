# Homey Community beta announcement draft

## OpenCCU – testers wanted for a local Homematic IP integration

I am looking for testers for an early version of a new open-source Homey Pro app that connects locally to OpenCCU.

Current scope:

- HmIP-RF physical devices and HmIP heating groups;
- local XML-RPC discovery, commands, and push events;
- JSON-RPC metadata, programs, system variables, and system status;
- dedicated product drivers plus a generic fallback for unknown devices;
- no Home Assistant, MQTT, CCU-Jack, or RedMatic runtime dependency;
- no migration from the previous Homey app: devices must be paired again.

Many drivers are based on typed profiles and automated fixtures but have not yet been verified with real hardware. Please use the beta only where temporary failures are acceptable, and do not depend on it for safety-critical control.

Test link: **[add Homey App Store Test URL after approval]**

Source and issue tracker: <https://github.com/branselbytes/homey-openccu>

When reporting a problem, please include the app/Homey/OpenCCU versions, product type and firmware, reproducible steps, expected and actual behavior, and the sanitized report created in the app settings. Please never post credentials, serial numbers, raw OpenCCU backups, or unreviewed raw logs publicly.

Especially useful are reports for products currently marked only as fixture-tested in `DEVICE_SUPPORT.md`, as well as unknown devices discovered by the generic driver.
