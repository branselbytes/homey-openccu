# ADR 0016: OpenCCU rooms and functions as device tags

## Status

Accepted

## Context

OpenCCU assigns rooms and functions (Gewerke) to channels. Homey calls Flow tokens “Tags”, while its zones are a separate hierarchy in which a device has one location. Automatic zone changes could overwrite a user's Homey organization and cannot represent multiple OpenCCU assignments.

## Decision

Expose non-empty OpenCCU room and function assignments through the read-only string capabilities `openccu_room` and `openccu_functions`. Homey automatically makes these device capabilities available as Flow tags.

Translate the internal channel IDs returned by `Room.getAll` and `Subsection.getAll` through the ID/address data from `Device.listAllDetail`. Associate each logical Homey device only with the channels used by its resolved bindings, button events, write targets, or naming channel. Sort and join multiple assignments deterministically.

Refresh the capabilities when JSON-RPC metadata changes. Do not create, rename, or move Homey zones.

## Consequences

- Existing and newly paired devices expose OpenCCU organization to Advanced Flow.
- Multi-channel actors do not inherit room/function assignments from unrelated outputs.
- Empty assignments do not add empty capability tags.
- JSON-RPC metadata failure leaves XML-RPC control operational and simply omits these tags.
- Homey zone mapping remains a separate future opt-in decision.
