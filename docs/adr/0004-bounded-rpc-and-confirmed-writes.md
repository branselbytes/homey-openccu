# ADR 0004: Bounded RPC and confirmed writes

- Status: accepted
- Date: 2026-09-03

## Context

Repeated app starts and parallel initial reads overloaded a test OpenCCU. Battery-powered thermostat commands could be applied after Homey's capability-listener timeout, while XML-RPC returned late, timed out, or reported a generic fault. Pair-time bindings could also become stale.

## Decision

- Admit at most two XML-RPC requests concurrently and prioritize registration and writes over queued reads.
- Persist schema-versioned channel `VALUES` descriptions, while refreshing device inventory on connection and invalidating affected cache entries from device callbacks.
- Activate Homey device bindings only after successful discovery and repair stored bindings from the current device graph.
- Acknowledge a slow write to Homey after 1.5 seconds, then require a matching callback or bounded read-back to verify the actual OpenCCU value.
- Restore a differing confirmed value and report commands that cannot be verified. Do not log command values or credentials.

## Consequences

OpenCCU receives bounded startup traffic and interactive commands are not trapped behind discovery reads. Homey remains responsive for slow radio devices without silently treating its optimistic value as authoritative. Cached metadata reduces restart load, while current inventory and callback invalidation limit staleness.
