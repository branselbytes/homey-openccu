# ADR 0005: Profile-driven device events

## Status

Accepted

## Context

HmIP remotes and combined devices report button presses as transient XML-RPC callbacks. A press is not durable device state and therefore does not belong in a Homey capability. Product generations also differ in their available button channels and press datapoints.

## Decision

Device profiles declare logical button-channel indices independently from capability bindings. Current OpenCCU discovery resolves only present `PRESS_SHORT` and `PRESS_LONG` datapoints into typed event bindings. The runtime-backed Homey device translates matching callbacks into the shared `hmip_button_pressed` device trigger with `button` and `press_type` tokens.

No event value is stored. Trigger errors remain isolated to the receiving Homey device and are logged without credentials or event payloads.

## Consequences

- Remotes keep product-specific drivers while sharing transport and event logic.
- Combined devices such as HmIP-SMI55 can expose stateful sensor capabilities and stateless buttons together.
- Firmware variants with missing datapoints do not produce unusable Flow events.
- Button channels and press variants still require fixture or hardware verification per product.
