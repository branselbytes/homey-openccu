# ADR 0001: Initial product scope

- Status: accepted
- Date: 2026-09-01

## Context

The imported application supports several interfaces and optional transports. The new project needs a narrow first implementation while retaining a path for broad device coverage.

## Decision

- The first implementation supports the `HmIP-RF` interface only.
- XML-RPC is the required transport for descriptions, values, commands, and push events.
- JSON-RPC supplies metadata, programs, and system variables. Programs and system variables are part of the first usable release.
- MQTT, CCU-Jack, RedMatic, Home Assistant, and Python are not required runtime components.
- BidCos-RF and CUxD are deferred until the HmIP-RF architecture is stable.

## Consequences

The initial protocol and hardware test matrix is smaller. Interface abstractions must nevertheless avoid HmIP-specific coupling so deferred interfaces can be added without redesigning the domain model.
