# Beta testing

OpenCCU Local (the Homey app developed by the OpenCCU for Homey project) is currently an early test version. Most product drivers are fixture-tested rather than hardware-verified. Use it on a Homey where temporary failures are acceptable, and do not rely on it as the only control path for safety-critical functions.

## Scope

- Homey Pro with Homey software 12.9.0 or newer;
- physical Homematic IP devices through the OpenCCU HmIP-RF interface;
- HmIP heating groups through the OpenCCU VirtualDevices interface;
- no migration from the predecessor app; devices are paired again.

The Homey App Store test link will be added here after the first Test release has passed Athom's initial review.

## What to test

For each device, record pairing, initial values, control from Homey, a physical or OpenCCU-side state change, Flow cards, app restart, OpenCCU restart, deletion, and re-pairing. Test only actions that are safe in your installation.

## Reporting a problem

Open an issue at <https://github.com/branselbytes/homey-openccu/issues> and include:

- app version, Homey model/software, and OpenCCU version;
- exact product type and firmware, but no device serial number;
- the operation, expected result, actual result, and approximate time;
- whether the value later arrived or changed through an OpenCCU push event;
- the sanitized diagnostics report from **Apps → OpenCCU → Settings → Create diagnostics report**.

The report exposes device types, firmware versions, datapoint definitions, selected drivers/capabilities, and aggregate runtime counters. It excludes credentials, IP addresses, central/device/channel identifiers, OpenCCU names, and current datapoint values. Review it before public upload anyway. Do not attach raw Homey logs, OpenCCU backups, screenshots containing serial numbers, or credentials to a public report.

If a raw log is genuinely required, wait for a maintainer to request the smallest relevant time window and agree on a non-public transfer method first.
