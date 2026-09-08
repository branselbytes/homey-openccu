# ADR 0016: Wired channels and configurable input modes

Status: accepted

## Decision

HmIPW-DRS8 exposes eight logical outputs with stable output identities. Each uses the physical SWITCH_TRANSMITTER STATE for feedback and the first associated SWITCH_VIRTUAL_RECEIVER STATE for commands. Other virtual receivers and their configured logic may affect the physical result.

HmIPW-DRI16 exposes logical inputs identified by channel number. Discovery reads CHANNEL_OPERATION_MODE from MASTER for each of the 16 channels and normalizes its enum using the returned VALUE_LIST. BINARY_BEHAVIOR maps read-only STATE to alarm_contact. KEY_BEHAVIOR and SWITCH_BEHAVIOR route PRESS_SHORT and PRESS_LONG through the existing button Flow trigger. Inactive, missing, and unknown modes expose neither state nor button events. Inactive inputs are omitted from new pairing candidates; existing identities remain resolvable.

Button conditions are independent of capability conditions. After an updateDevice callback, the runtime invalidates descriptions and repeats discovery. A discovery-completed event lets existing read-only/event devices reconcile bindings, capabilities, and event routes. Writable-device live remapping remains outside this change.

## Consequences

A mode change does not require deleting and re-pairing an existing input. Flow cards tied to a capability removed by a mode change can require user adjustment; stable device identity cannot preserve incompatible Flow semantics. If OpenCCU does not send an updateDevice notification, a new discovery or app restart is required.

Reduced fixtures come from read-only XML-RPC descriptions of dedicated user-provided devices on 2026-09-08; serials are replaced and current values omitted. The mode-to-datapoint distinction was cross-checked against the already pinned aiohomematic design reference; no source was copied. Physical switching and button events remain hardware test gates.
