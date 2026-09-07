# Compatibility

This document distinguishes the intended platform from combinations that have actually passed end-to-end tests. A technically plausible combination is not presented as supported until it has been exercised.

## Homey

The app manifest requires Homey software **12.9.0 or newer**, the point at which Homey apps run on Node.js 22 across Homey platforms. The initial product target is the current local Homey Pro family.

| Platform               | Initial status                                | Rationale                                                                                  |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Homey Pro (Early 2023) | target; exact hardware verification to record | Current local Pro generation with sufficient memory and ongoing software support           |
| Homey Pro (2026)       | target; hardware verification pending         | Current local Pro generation                                                               |
| Homey Pro mini         | expected compatible; not yet release-verified | Same current app runtime, but no project test device has been recorded                     |
| Homey Pro (2016–2019)  | outside the initial support claim             | Node.js 22 is available on current software, but memory and full app behavior are untested |
| Homey Cloud            | unsupported                                   | XML-RPC callbacks and OpenCCU traffic require direct local network reachability            |

The authoritative Homey runtime table is maintained in the [Homey Apps SDK documentation](https://apps.developer.homey.app/the-basics/app). Athom's [Homey Pro support policy](https://support.homey.app/hc/en-us/articles/13455016712604-Software-support-for-Homey-Pro) identifies the currently maintained Pro family.

## OpenCCU

The current development system has verified the eQ-3 UDP discovery response, HmIP-RF XML-RPC registration/discovery/commands/callbacks, and JSON-RPC metadata against OpenCCU **3.89.8.20260719**. This is the first recorded compatibility point, not yet a minimum-version promise.

Before the first release, each supported OpenCCU version must pass the release integration checklist. Older releases may work if they provide the same APIs, but are not supported solely by inference. Current OpenCCU releases are published by the [OpenCCU project](https://github.com/OpenCCU/OpenCCU/releases).

Required default endpoints:

| Purpose                           | Protocol and default port              |
| --------------------------------- | -------------------------------------- |
| HmIP-RF devices                   | XML-RPC TCP 2010                       |
| HmIP heating groups               | VirtualDevices XML-RPC TCP 9292        |
| Metadata and hub functions        | JSON-RPC HTTP TCP 80                   |
| Homey callback for HmIP-RF        | XML-RPC TCP 12010, OpenCCU to Homey    |
| Homey callback for VirtualDevices | XML-RPC TCP 12011, OpenCCU to Homey    |
| Optional central discovery        | UDP 43439, local broadcast domain only |

Ports are configurable where the OpenCCU installation differs. Firewalls and VLAN routing must permit Homey-to-OpenCCU requests and OpenCCU-to-Homey callback connections. Discovery broadcasts do not replace manual host configuration on routed networks.

## Release evidence still required

- Record the exact Homey model and software version for the existing Homey Test system.
- Repeat fresh install, upgrade, restart, deletion, and re-pairing tests on every claimed Homey generation.
- Exercise at least the oldest and newest OpenCCU versions that the first release intends to support.
- Record callback, authentication, firewall, and VirtualDevices behavior for each tested combination.
