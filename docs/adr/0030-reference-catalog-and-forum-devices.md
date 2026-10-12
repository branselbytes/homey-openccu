# ADR 0030: Reference catalog expansion and multi-channel forum devices

Date: 2026-10-12
Status: Accepted

## Decision

Compare the radio/Wired Homematic IP catalog with Homematic(IP) Local and
its aiohomematic model layer. Use independently authored declarative profiles,
verified XML-RPC channel/parameter facts, and existing functional families.
Do not introduce a Home Assistant runtime dependency or copy reference code.

HM-SCI-3-FM exposes three contacts in one Homey device. HM-Sec-Sir-WM
separates perimeter, interior and panic alarm channels from its arming channel.
HmIP-STE2-PCB retains its existing identity and primary temperature capability;
channels 2 and 3 add temperature and CCU-computed difference in that device.

Metadata gates every command. Read-only sensors and floor-heating valve feedback
remain explicitly read-only even if a firmware description grants wider access.
Do not infer actuator channel layouts from model-name similarity. Infrastructure
such as CCU3, HAP and RFUSB is not a controllable end device.

## Evidence

- Forum: https://community.homey.app/t/app-pro-homematic-ip-local-openccu/160314/16
- Homematic(IP) Local: https://github.com/sukramj/homematicip_local
- aiohomematic: revision 8b8c5459f1d263d9dc248892532079b8cb73e7cc
- pydevccu recorded metadata: revision 6fe7695f049219c77cbda2b60131fdf61d836000
- OCCU device descriptions: revision d9d7acbb37c29703f71c89cf3c1f62c390ddcfb2

Reference projects are design/metadata references only. Project fixtures use
synthetic identities and selected protocol facts, not original user recordings.
Catalog coverage does not imply physical validation or every vendor configuration
option. Publish remaining functional limitations alongside supported functions.
