# ADR 0012: Dedicated OpenCCU system device

## Status

Accepted

## Context

OpenCCU exposes central health information that is not owned by an individual Homematic device. Duty cycle, carrier sense, active service-message count, connection state, and discovered-device count are useful in Homey and for Flows, but mapping them onto an arbitrary radio device would create an unstable identity and duplicate polling.

Homey requires a static driver manifest, while one app configuration may contain more than one OpenCCU central. Some radio modules do not report carrier sense, and older or alternative CCU-compatible backends may not implement every OpenCCU JSON-RPC extension.

## Decision

Provide one pairable `openccu-system` Homey device per configured central. Its identity is derived only from the configured central ID and does not impersonate an HmIP-RF device.

The system device exposes read-only connection, inventory, service-message, duty-cycle, and carrier-sense capabilities. It refreshes system information every 60 seconds while the XML-RPC runtime is healthy. `Interface.getDutyCycle` and `Interface.getServiceMessageCount` run as independent JSON-RPC requests; unsupported or malformed results are isolated and left unknown rather than represented as zero. With multiple reported radio interfaces, the displayed duty cycle and carrier sense are the respective maxima, while the complete normalized interface list remains available at the runtime boundary.

Detailed active service messages are available through one app-level dashboard widget. The widget uses a read-only ReGa script via `ReGa.runScript`, refreshes once per minute while open, and shares a 30-second app cache across widget instances. Its API omits raw device addresses and full alarm object names; it exposes only the normalized message code, optional configured device name, timestamps, occurrence count, and non-identifying message ID. Failures are isolated per central and return no transport error text to the widget.

## Consequences

- Users can add a stable central-level device and use its numeric and boolean capabilities in Homey Insights and Flows.
- Polling adds two JSON-RPC calls per configured central per minute, not per Homematic device.
- JSON-RPC credentials are required for radio-load and service-message metrics; XML-RPC connection state and discovered-device count remain available independently.
- Missing carrier-sense support is a normal capability-data gap and does not make the system device unavailable.
- Detailed messages add no background traffic unless at least one dashboard widget is open.
- Live OpenCCU response shapes and behavior still require hardware verification and redacted fixtures.
