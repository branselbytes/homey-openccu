# ADR 0027: Hörmann light button within the existing device

- Status: accepted
- Date: 2026-10-04
- Extends: ADRs 0004 and 0023

## Context

[Forum post 5](https://community.homey.app/t/app-pro-homematic-ip-local-openccu/160314/5) confirms working controls but reports that the light requires selecting another toggle from a dropdown. Native capability titles also read as states rather than identifying the door and light. The owner explicitly wants a separate light button within the existing device, not a second device or tile.

## Decision

- Keep the existing pairing identity, native `garagedoor_closed` and `onoff`, and all existing Flow cards. Add the stateful boolean `homematic_garage_light` with Homey's `button` UI component, alongside the ventilation button. Both light controls bind to channel 2 `STATE`; the button sends explicit boolean values, never a guessed inverse or a door command.
- Keep native `onoff` for existing Flow actions, conditions and triggers, and hide its device-view component with the scoped capability option `uiComponent: null`. The light is shown once, as the stateful button; the door remains the only native toggle. Do not remove or rename capability IDs or create another device. Homey's generated Flow card titles remain unchanged for compatibility.
- Add explicitly named garage-light actions, a light-state condition and light-state triggers, plus a garage-position change trigger. Actions and the condition use the existing capability/write boundary and reported device state; toggle and the condition reject an unknown light state. Triggers follow Homey's automatic custom-capability convention, without duplicate manual triggering. Existing generic Flow cards remain available. Door-position and ventilation labels explicitly identify the garage door.
- Label the native capabilities `Garage door` / `Garagentor` and `Light` / `Licht`. Reconcile titles and the hidden `onoff` UI option for existing dedicated devices only when needed, preserving unrelated options.
- Initial reads and callbacks update both bindings. Confirmed or final differing read-back values also update exact readable aliases sharing channel, parameter and transform. A new readable write supersedes pending verification for the same command target; stale in-flight results cannot overwrite its state.
- Provide a development-only, separately identified Homey demo app generated from the recorded device metadata and production driver/runtime. Its simulated RPC stays in memory and does not connect to a CCU. It is excluded from the production app. Installation is a separate explicit action.

## Consequences and validation

Homey determines tab layout. A scoped live probe on Homey 13.5.1 confirmed that `onoff.uiComponent: null` removes the light from the toggle selector while retaining native light Flow cards. The toggle view contains the garage door; the button view contains light and ventilation. Older supported Homey versions have not been verified for this UI override. The standard device tile still has one configurable quick-action slot.

Recorded-fixture tests cover unchanged identity and upgrade, both light write paths, callbacks, missed-event read-back, superseded writes, and errors. The separate demo supports native Homey UI and Flow inspection without hardware. The scoped Homey 13.5.1 probe provides evidence for the UI override; it does not verify physical radio communication or motor behavior.
