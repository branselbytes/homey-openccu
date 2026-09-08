# ADR 0017: Wired infrastructure and presence profiles

Status: accepted

## Decision

HmIPW-DRAP is one diagnostic Homey device. Channel 0 supplies temperature, operating voltage, reachability, and individual electrical/configuration faults. Channels 1 and 2 supply separate bus voltage/current measurements. Standard Homey sub-capabilities distinguish the buses and faults with English/German titles; current converts mA to A. All mapped datapoints are read-only. Identification, installation-test commands, and IP address are excluded.

HmIPW-SPI has its own presence profile using alarm_motion and measure_luminance. ILLUMINATION is preferred for callback-driven updates, with CURRENT_ILLUMINATION as a discovery fallback. No battery capability is declared for this Wired model.

The existing HmIP-BRC2 profile already covers the two button channels and short/long event variants. Its live description has no battery datapoint, so it correctly pairs as an event-only device. Recorded fixture tests cover this case without adding a duplicate driver.

## Verification boundary

Reduced, anonymized XML-RPC descriptions were captured on 2026-09-08 from one DRAP, four Wired presence detectors, and one BRC2. Tests exercise mapping, conversions, callback routing, and distinct fault channels. Real presence changes, fault conditions, and button presses require separate hardware confirmation.
