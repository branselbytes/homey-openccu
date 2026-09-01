# ADR 0003: Typed protocol and domain boundaries

- Status: accepted
- Date: 2026-09-01

## Context

The imported app lets Homey devices call callback-based RPC libraries directly. This couples transport lifecycle, device semantics, capability mapping, and event listeners, which makes reconnect behavior and fixture testing difficult.

## Decision

- New protocol and domain code lives under `src/` and has no Homey dependency.
- The existing `homematic-xmlrpc` package is isolated behind a typed Promise adapter and callback dispatcher. Its concrete client defaults to the HmIP-RF port 2010.
- JSON-RPC 1.1 uses the Node.js 22 Fetch API with explicit timeout, optional HTTP basic authentication, categorized errors, and managed OpenCCU sessions (`Session.login`, renew, and logout).
- Connection supervision, normalized domain models, typed events, caches, mapping decisions, and diagnostics are independent components.
- Persisted description data is wrapped in a schema-versioned envelope. Live values are not treated as durable cache state.
- Diagnostic output redacts credentials, addresses, and live values by default.

## Consequences

Protocol and domain behavior can be tested without Homey or OpenCCU hardware. The legacy app still uses its old connections until a later integration phase switches it to these components. The untyped XML-RPC dependency can be replaced behind the adapter without changing consumers.
