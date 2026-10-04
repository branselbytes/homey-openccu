# ADR 0026: Bound metadata allocations and cache storage

Status: accepted, 2026-10-04.

## Context

The owner reported an app crash and "Memory Warning Limit Reached" while opening/reloading heating profiles after the development installation. Initial Homey measurements were approximately 141–146 MB PSS. The six-profile MASTER description contains 1,092 schedule parameters; its XML response is about 464 kB before the separate values response. Repeatedly parsing these descriptions creates substantial temporary allocations. Local forced-GC measurements did not identify a retained schedule leak, so this evidence does not prove the complete cause of the reported crash.

Further live instrumentation observed warnings before any heating-profile read, including the earlier unchanged service build. Startup performs full description invalidation when the CCU announces its inventory on registration. The existing adapter maps each cache invalidation/write to a Homey settings mutation; the measured installation has 273 such keys (about 251 kB total) and 368 startup RPC requests. This creates avoidable settings-event and serialization traffic during discovery. A profile-only optimization cannot address that startup path.

## Decision

Compile MASTER metadata once into a validated compact schema, including precomputed limits and a schema digest. Cache at most four channel schemas for five minutes per runtime. Ordinary refreshes still fetch actual schedule and active-profile values; they do not cache the user's schedules. Coalesce simultaneous reads of the same target, admit at most four distinct pending display reads, and serialize large snapshot reads across targets. Release raw metadata before fetching schedule values.

Always fetch fresh metadata before saving and during read-back. Keep existing exact input validation, current-value revision comparison, targeted patches, explicit FLOAT encoding, per-channel write locks and pending/confirmed semantics. A display cache must never bypass write permissions or hide metadata changes from the save conflict check. Cache failures remove the affected schema; all queues settle after failures.

Add bounded, on-demand process diagnostics and observe the official Homey `memwarn` event. Store only an aggregate warning count and the latest event's allowlisted numeric fields. Missing runtime memory APIs remain unavailable rather than being reported as zero. Do not enable an inspector, force garbage collection, change VM limits or introduce background diagnostic polling in the app. Live PSS can be measured externally through Homey's usage API.

Replace the production `VALUES` description cache's Homey settings storage with a bounded in-memory backend: at most 512 entries and 2 MiB of UTF-8 key/value data, with least-recently-used eviction. The byte budget bounds serialized data, not all JavaScript heap overhead. Preserve schema envelopes, cache keys, callback invalidation and fresh RPC fallback. A cache miss, eviction or oversized entry only costs another read. Leave the legacy persisted cache keys untouched and unused; user connection settings and paired-device data are unaffected. This supersedes the persistent-storage choice in ADR 0004 without changing transport or metadata freshness rules.

## Consequences and validation

Displayed metadata can be at most five minutes old, while schedule values remain freshly read and every save revalidates metadata. Cache size and pending display work stay bounded. The cold first read still needs the full metadata response, so a lower repeated-read peak is not a guarantee against every memory issue.

Discovery refetches descriptions after every app restart. In return it no longer emits hundreds of Homey settings changes for disposable metadata. Reconnects within the same process can reuse valid entries, and existing callback invalidation still takes precedence. Live deployment measurements are required to assess the actual startup improvement rather than inferring it only from reduced writes.

Recorded metadata, synthetic schedules and real XML deserialization measure allocation changes; unit tests cover cache expiry/eviction, request coalescing, queue cleanup and fresh write validation. Live checks must compare cold reads, repeated refreshes and a post-expiry read while observing PSS, warning counters, app uptime and device availability. No physical schedule write is needed for this investigation.

The deployment comparison on Homey Christian measured 34–38 MB PSS at startup and a maximum of 48.7 MB across a cold profile read, ten sequential refreshes, eight simultaneous requests and another read after schema expiry. The app reached 396 seconds uptime with zero memory warnings or restarts, compared with the previous 129–156 MB and repeated warning-limit restarts. This isolates the storage-backend change as effective for the reproduced workload; it does not identify every allocation inside Homey's settings implementation or establish indefinite stability.

Reference: [Homey memory-warning event](https://apps-sdk-v3.developer.homey.app/Homey.html#event:memwarn).
