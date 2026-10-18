# ADR 0032: Preserve mappings during incomplete discovery and recover device availability

Status: accepted for 0.1.12 beta.

## Evidence

[Forum post 19](https://community.homey.app/t/app-pro-homematic-ip-local-openccu/160314/19) reports loss of SRH handle/battery capabilities and related Flow conditions after enabling BidCos-RF. The code accepted partial description discovery as an authoritative mapping and removed absent capabilities. This path is reproducible; the original trigger involving BidCos-RF remains unverified.

[Post 20](https://community.homey.app/t/app-pro-homematic-ip-local-openccu/160314/20) shows `OpenCCU command delivery could not be verified` for BROLL-2. Exhausted verification read errors made the device unavailable, with no recovery on subsequent datapoint callbacks. Existing pending-write identity checks already discard superseded read failures; the new recovery work must preserve those guarantees.

## Decision

- Track device discovery completeness from listed channels, VALUES descriptions and successful requested configuration reads. Optional absent configuration parameters are not transport failures.
- Do not persist incomplete mappings or remove existing capabilities based on them; hide incomplete new pairing candidates. Retry incomplete discovery via the inventory queue, starting at 30 seconds and backing off to at most one attempt every five minutes. Keep existing cache behavior and cancel timers at shutdown.
- Reconcile complete read-only and writable mappings. Register listeners once per capability, resolve their current binding at command time and discard pending verification from replaced mappings.
- After exhausted verification read errors, recover through a callback for the affected datapoint or a read-only probe every 30 seconds. Successful communication restores availability independently of the previous command target. Never replay motor commands.
- Retain pending-write identity checks on failures as well as successes. Stop queued controller work, timers and stale in-flight recovery results when a controller is replaced.

## Limits and verification

Regression tests exercise production discovery, profile mapping, callbacks and binding controllers using simulated XML-RPC responses. Mixed-interface tests check that classic discovery failure does not remove HmIP capabilities. These tests do not prove the original users' timeouts are fixed or that all physical devices recovered overnight. A general interface heartbeat/re-registration policy is outside this focused change.

The beta requires field confirmation with BidCos-RF enabled and the original shutter Flows. Existing device identities, capability IDs and Flow IDs remain stable. Already damaged Flow definitions cannot be guaranteed recoverable merely by restoring a device capability.
