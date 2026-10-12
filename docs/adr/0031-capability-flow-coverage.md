# ADR 0031: Shared capability-level status Flows

Date: 2026-10-12
Status: Accepted

Expose the previously missing readable custom statuses through a declarative
Flow catalog. Generate capability/driver-filtered triggers and conditions from
the app's capability definitions and shared profiles, including logical outputs
and existing generic devices. Existing Flow IDs remain intact. Numeric statuses
have numeric value tags and comparison conditions; enums and booleans additionally
have localized text tags. Write-only commands and organization metadata do not
receive invented status triggers. Detection and boost-off actions use existing
validated capability listeners and XML-RPC routing.

Use explicit `ccu_` trigger IDs to avoid Homey's automatic custom-capability
trigger convention causing duplicate execution. Per-capability queues publish
the value before triggering. Initial reads, duplicates, unknown recovery and
reconnect initialization are silent. Revision/epoch guards reject stale reads
and stopped work. Confirmed command readbacks count as updates. The system
device uses the same transition logic for connection events and polled metrics;
its first snapshot is silent, while later disconnection/reconnection is visible.

SPDR count triggers carry the last reported direction as a text tag. CCU count
and direction arrive independently; this is not an atomic passage snapshot and
no direction is guessed. Its boolean direction capability remains a separate
tag and trigger. Pure value tags retain their existing capability IDs.
