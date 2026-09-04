# ADR 0006: Logical devices for multi-channel actuators

## Status

Accepted

## Context

A single HmIP actuator can expose several independently controlled outputs. Combining all outputs into one Homey tile would make standard capabilities ambiguous, while treating the physical address as the only identity would prevent pairing more than one output.

## Decision

A product profile may declare logical devices. Each logical device owns a stable profile ID, an output label, an optional OpenCCU name channel, and its capability/event definitions. Pairing creates one candidate per logical device and appends its logical ID to the existing central/interface/device identity.

Runtime-backed devices retain the physical OpenCCU address plus the logical ID and re-resolve only that mapping after discovery. Profiles without logical devices keep their existing identity and behavior unchanged.

## Consequences

- Every independently controllable output receives a normal Homey device and standard Flow cards.
- Profile-owned logical IDs must never be renumbered after release.
- Channel layouts remain curated per product and require fixtures or hardware reports.
- A future compound device may combine logical outputs of different Homey classes, which could require separate product-facing drivers or an extended logical manifest strategy.
