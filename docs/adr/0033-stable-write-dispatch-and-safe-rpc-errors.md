# ADR 0033: Stable capability dispatch and safe RPC error details

Date: 2026-10-23
Status: Accepted

The supplied user report labels the app 0.1.12 and shows repeated capability
listener registration, successful RPC write acknowledgements and failing cover
read-backs. It does not contain the protocol category or CCU fault code. Neither
a Classic/HmIP conflict nor physical command execution can be established from
these lines alone.

Keep Homey capability listeners registered once per device capability and switch
their controller target on runtime replacement. A stopped target rejects writes;
stale unsubscription cannot detach a newer target. Reset registration only after
Homey successfully removes the capability. This avoids repeated registration
warnings without changing motor commands or retry behavior.

Retain safeErrorKind for existing consumers. Device adapters use safeErrorSummary:
only known ProtocolError categories and signed 32-bit remote fault codes are
appended. Property descriptors avoid invoking code/fault accessors. Raw messages,
causes, stacks, addresses and credentials remain excluded.

Run BROLL-2 fixture scenarios through the managed runtime with Classic both on
and off, then issue Flow-style up/down capability writes and inject read-back
faults. These tests establish routing and continued operability under simulated
failures, not reproduction of the user's original transport fault. No speculative
endpoint change, getValue fallback or automatic motor retry is introduced.

The managed-runtime numeric callback test exposed a separate reproducible defect:
`activity-state-to-cover-state` accepted only strings and threw a local
`ProtocolError(invalid-response)` on valid numeric enums. Support indices 0–3
(UNKNOWN, UP, DOWN, STABLE), preserving existing string behavior and rejecting
invalid numbers. This affects initial reads, read-back and callbacks, and can
produce the same error class as the report without a failed RPC response. The
report's missing error details prevent definitive attribution to this defect.
The enum is also documented as an integer in the manufacturer's
[HmIP device documentation](https://www.eq-3.de/downloads/download/homematic/hm_web_ui_doku/HmIP_Device_Documentation-1.38.4.pdf)
and appears in the existing BROLL-2/reference fixtures.
