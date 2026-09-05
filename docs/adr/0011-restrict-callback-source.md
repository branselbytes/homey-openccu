# ADR 0011: Restrict callback connections to OpenCCU

## Status

Accepted

## Context

HmIP-RF push events require an HTTP XML-RPC listener on Homey's LAN interface. XML-RPC callback requests do not carry application credentials, so an unrestricted listener would allow other reachable hosts to inject syntactically valid events.

## Decision

The callback server accepts TCP connections only when the remote address matches the configured OpenCCU host. Literal IPv4 and IPv6 addresses are normalized directly; host names are resolved for each new connection. Connections remain paused during resolution and are destroyed on mismatch or resolution failure. The XML-RPC dispatcher therefore never receives rejected traffic.

This is a source-address boundary, not cryptographic authentication. Routed networks must preserve the OpenCCU source address; installations using a TCP proxy or source NAT require a future explicit trusted-proxy design rather than silently widening access.

## Consequences

LAN event injection from unrelated hosts is blocked before XML parsing. Commands and polling remain unaffected. Callback delivery must be tested across supported VLAN, DNS, IPv4, and IPv6 layouts, and the application continues to expose a disconnected state when registration or events fail.

The literal-IPv4 path is live-verified on Homey Test with OpenCCU across the current routed subnets: weather callbacks continued to update Homey, while a valid `system.listMethods` XML-RPC request from the development host was disconnected without a response.
