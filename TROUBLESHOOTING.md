# Troubleshooting

## Connection checklist

Open **Apps → OpenCCU for Homey → Settings** and verify the central ID, OpenCCU host, HmIP-RF port (normally `2010`), Homey callback port (default `12010`), and optional credential pair. Enter only a host name or IP address, without `http://` or a path.

The network must permit:

- Homey → OpenCCU TCP `2010` for HmIP-RF XML-RPC;
- Homey → OpenCCU HTTP for JSON-RPC metadata;
- OpenCCU → Homey TCP on the configured callback port for push events.

The callback source must be the configured OpenCCU host. A TCP proxy or source NAT changes that source address and is not supported yet. Firewall changes should be limited to the relevant Homey/OpenCCU addresses; do not expose either service to the internet.

## Devices are offline

Confirm that OpenCCU's WebUI is responsive and that the app's downloaded diagnostic report says `healthy`. Restarting OpenCCU can temporarily remove callback registration; the app retries automatically. If the state remains disconnected, check routing and all three directions/ports above before restarting Homey.

## Commands time out or arrive late

HmIP devices can acknowledge commands several seconds after the XML-RPC call. The app keeps a command pending and confirms it from a push event or bounded read-back. A busy OpenCCU can delay both paths. Check OpenCCU CPU/load and avoid repeated commands while its WebUI is slow.

Do not assume a Homey tile update alone proves delivery: writable values are verified against OpenCCU before becoming authoritative.

## Values do not update from OpenCCU

If initial values appear but later OpenCCU changes do not, the callback direction is blocked or the source address differs. Verify OpenCCU can reach Homey's current LAN address and callback port. VLAN routing must preserve OpenCCU's source address.

## Pairing and unknown devices

Save a valid OpenCCU connection before pairing. Choose the dedicated product driver when available. Use **Generic OpenCCU device** only for a new or currently unsupported product; generic mappings are intentionally conservative.

There is no migration from the predecessor app. Devices must be paired again, and deleting a Homey device does not delete it from OpenCCU.

## Support report

In the app settings, select **Download diagnostics**. The JSON report contains anonymous connection states and aggregate counters only. It omits credentials, network addresses, central IDs, OpenCCU names, device addresses, and datapoint values. Review the file before attaching it to a public issue.

When reporting a problem, include the app/Homey/OpenCCU versions, product type and firmware, the operation performed, observed behavior, and the diagnostic report. Never post credentials or an unredacted OpenCCU backup.
