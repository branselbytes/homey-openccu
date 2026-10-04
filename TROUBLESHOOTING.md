# Troubleshooting

## Connection checklist

Open **Apps → OpenCCU Local → Settings** and verify the central ID, OpenCCU host, HmIP-RF port (normally `2010`), VirtualDevices port (normally `9292`), both Homey callback ports (defaults `12010` and `12011`), and optional credential pair. Enter only a host name or IP address, without `http://` or a path.

The network must permit:

- Homey → OpenCCU TCP `2010` for HmIP-RF XML-RPC;
- Homey → OpenCCU TCP `9292` with path `/groups` for heating groups through VirtualDevices;
- Homey → OpenCCU HTTP for JSON-RPC metadata;
- OpenCCU → Homey TCP on both configured callback ports (normally `12010` and `12011`) for push events.

The callback source must be the configured OpenCCU host. A TCP proxy or source NAT changes that source address and is not supported yet. Firewall changes should be limited to the relevant Homey/OpenCCU addresses; do not expose either service to the internet.

## Devices are offline

Confirm that OpenCCU's WebUI is responsive and that the app's downloaded diagnostic report says `healthy`. Restarting OpenCCU can temporarily remove callback registration; the app retries automatically. If the state remains disconnected, check routing and all three directions/ports above before restarting Homey.

## Commands time out or arrive late

HmIP devices can acknowledge commands several seconds after the XML-RPC call. The app keeps a command pending and confirms it from a push event or bounded read-back. A busy OpenCCU can delay both paths. Check OpenCCU CPU/load and avoid repeated commands while its WebUI is slow.

Do not assume a Homey tile update alone proves delivery: writable values are verified against OpenCCU before becoming authoritative.

## Values do not update from OpenCCU

If initial values appear but later OpenCCU changes do not, the callback direction is blocked or the source address differs. Verify OpenCCU can reach Homey's current LAN address on the callback port for the affected interface: HmIP-RF normally uses `12010` and VirtualDevices normally uses `12011`. VLAN routing must preserve OpenCCU's source address.

## Pairing and unknown devices

Save a valid OpenCCU connection before pairing. Choose the dedicated product driver when available. Use **Generic OpenCCU device** only for a new or currently unsupported product; generic mappings are intentionally conservative.

There is no migration from the predecessor app. Devices must be paired again, and deleting a Homey device does not delete it from OpenCCU.

## Support report

In the app settings, select **Create diagnostics report**. Copy the short summary for a forum post; select the affected model to include its relevant datapoint definitions. Save/share the complete JSON file and attach it to a GitHub issue. The forum may reject JSON/TXT attachments, and a complete report can exceed a text field's length limit; renaming or pasting the full file is unnecessary. If sharing is unavailable, the app offers a download; if clipboard access is blocked, the selected summary can be copied manually.

The sanitized report includes connection states, counters, device types, firmware versions, channel/datapoint definitions, selected drivers/capabilities and the most recent XML-RPC error category and optional CCU fault code. It omits credentials, network addresses, central IDs, OpenCCU names, device addresses, current datapoint values and remote error messages. Review the report before attaching it to a public issue.

When reporting a problem, include the app/Homey/OpenCCU versions, product type and firmware, the operation performed, observed behavior, and the diagnostic report. Never post credentials or an unredacted OpenCCU backup.

For HmIP-MOD-HO motor or light errors, create the report after the failed operation and before restarting the app. Include whether opening, stopping, closing, ventilation or light switching failed and the displayed fault code, if available. A successful background read does not erase the latest failed request; a later failure replaces it and restarting resets it. The detailed **Position unknown** reading is a valid device state and does not itself identify why a command was rejected.
