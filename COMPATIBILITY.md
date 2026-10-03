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

## SWDO family and current field report

The user reported on **2026-10-03** that the currently installed app works well on their Homey, with no observed disconnects. The exact software versions, observation period and exercised devices were not specified in this follow-up; it is a user report rather than a controlled reconnect test.

App version **0.1.2** groups SWDO, SWDO-2, SWDO-I, and the new SWDO-A under one pairing entry. Installation on **Homey Christian, software 13.5.0**, was verified on 2026-10-03: the app is running, all 13 existing devices remain available with unchanged identities and retained capabilities, and the CCU runtime is healthy with zero discovery issues. Live discovery recognizes SWDO-A through the shared profile with contact and battery capabilities. Physical SWDO-A pairing and opening/closing events remain unverified. See [device coverage and upgrade behavior](DEVICE_SUPPORT.md#swdo-family).

## Maintenance verification for 0.1.3 (2026-10-03)

The local maintenance build resolves eight recorded device types through the shared PSM, eTRV, SWDO and new Wired STH profiles. Read-only checks against the configured CCU successfully read 25 mapped values across six reachable models, including the Wired STH-A and SWDO-A. The CCU reported the sampled HmIP-PSM-2 and HMIP-SWDO as unreachable (`UNREACH = true`), so their current-value checks were skipped. Their device descriptions were available and are covered by recorded-fixture tests.

This verifies discovery and reads, not physical commands, new pairing or a production upgrade. PSM-2 switching, Wired STH commands and real add/remove callbacks remain hardware checks. Wired STH modes 0–3 and week profiles 1–6 remain deferred until complete Homey controls exist. The installed Homey app remains version 0.1.2; see the [maintenance delivery record](IMPLEMENTATION_PLAN.md#project-maintenance-audit-2026-10-03-unreleased).

Socket/artwork follow-up: the local build also consolidates PS/PSM pairing and corrects catalog images and model-specific family pairing icons. The full suite now passes 409 tests, with Homey publish-level validation successful. Actual Homey rendering after installation remains unverified; existing saved per-device icon overrides are preserved.

## Release evidence still required

- Record the exact Homey model and software version for the existing Homey Test system.
- Repeat fresh install, upgrade, restart, deletion, and re-pairing tests on every claimed Homey generation.
- Exercise at least the oldest and newest OpenCCU versions that the first release intends to support.
- Record callback, authentication, firewall, and VirtualDevices behavior for each tested combination.
