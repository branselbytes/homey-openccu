# ADR 0015: UDP discovery is an explicit settings convenience

- Status: accepted
- Date: 2026-09-05

## Context

OpenCCU answers the established eQ-3 UDP discovery request on port 43439. The response provides the central type, serial, and source address, but no authentication material. Homey cannot enumerate or pair devices until a complete connection, including credentials where required, has been saved and its runtimes have connected.

UDP broadcast is limited to the local broadcast domain. It commonly does not cross VLANs, routed subnets, container bridges, or restrictive Wi-Fi networks. The current Homey Test and OpenCCU installation are on routed subnets, so manual host entry must remain a first-class path.

## Decision

The settings view offers discovery only after an explicit button press. A bounded two-second UDP scan sends no credentials and returns every structurally valid response. It broadcasts in the local network and also probes already stored IPv4 hosts directly, allowing a configured central to be verified across routed subnets without accepting an arbitrary API target. Selecting a result fills the host and, only if it is empty, the central ID. The app never saves a discovered result automatically.

The protocol parser accepts only the known five-byte discovery header, bounded printable type and serial fields, and an IP source address. Duplicate replies are collapsed. Manual host configuration remains available and authoritative.

Discovery lives in settings immediately before pairing rather than inside every product driver's `list_devices` view. A device pairing session needs an already authenticated, healthy runtime; embedding incomplete central setup in 73 driver flows would duplicate UI and blur credential ownership.

## Consequences

- Same-subnet installations gain one-click address discovery.
- Routed installations continue with manual host entry for initial setup; already configured IPv4 hosts can be verified by unicast.
- Discovery does not prove XML-RPC/JSON-RPC reachability or credentials; saving the connection and runtime health do that.
- The fixed UDP client port can conflict with another discovery process; such failures are returned to the settings UI instead of weakening the manual fallback.

The packet and response layout were verified read-only against the project OpenCCU. The regression fixture retains the observed structure but replaces the serial and trailing details with synthetic values.
