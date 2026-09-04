# ADR 0007: Product command strategies

- Status: accepted
- Date: 2026-09-04

## Context

Some HmIP controls cannot be represented by writing the capability's readable datapoint. A smoke detector accepts intrusion-alarm enum commands, while HmIP-ASIR requires acoustic selection, optical selection, duration unit, and duration value to be sent together. Exposing a Homey control without the corresponding writable OpenCCU datapoint would produce a misleading read-only capability.

## Decision

- Keep ordinary capability writes as typed single-datapoint XML-RPC operations.
- Represent product-specific command conversions as named write strategies selected by a device profile.
- Use one XML-RPC `putParamset` operation when a command requires a coherent set of values.
- Allow profiles to require every datapoint needed by a command to be discovered as writable before their command capability is exposed.
- Keep default siren tone, light pattern, and duration deterministic until richer Homey Flow actions are designed.

## Consequences

The generic mapper remains conservative and product-neutral. Known devices can expose correct command behavior without embedding Python or Home Assistant at runtime, and firmware variants that omit a command datapoint do not receive a broken control. Each new strategy requires focused mapping and transport tests plus later hardware verification.
