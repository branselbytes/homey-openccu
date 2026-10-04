# Hörmann garage UI simulation

This development-only Homey app shows the production HmIP-MOD-HO driver with a simulated garage door and light. It uses the recorded metadata fixture, shared profiles, runtime and Flow handlers. RPC calls and callbacks stay in memory; no physical CCU or motor is contacted.

The app has the separate ID `io.github.branselbytes.openccu-demo` and the name **OpenCCU Garage Simulation** / **OpenCCU Garagen-Simulation**. It contains one garage device with door and light controls, not a separate lamp device. Production app data is not used.

## Prepare

From the repository, using Node.js 22 or newer:

```sh
npm run demo:garage -- --output /tmp/openccu-garage-demo
cd /tmp/openccu-garage-demo
npm ci --ignore-scripts
npm run typecheck
npx --no-install homey app build
npx --no-install homey app validate --level publish
```

The output must be an empty or absent directory outside the repository. The generator refuses to overwrite an existing project. It copies an explicit file allowlist, including the current production driver and fixture; generate a fresh directory after changing those sources. The simulation sources are under `scripts/` and are excluded from the production app by `.homeyignore`.

Installation changes the selected Homey and requires the owner's explicit approval under `AGENTS.md`. After approval, select the intended Homey and use the normal `homey app install` command from the generated project. Do not use `--clean`, install the production project by mistake, or reuse a standalone validation build with `--skip-build`: normal installation rebuilds the complete package with runtime dependencies.

## Inspect in Homey

1. Add a device from **OpenCCU Garagen-Simulation**, choose **HmIP-MOD-HO**, and select **Garagentor (Simulation)**.
2. Open that single device. The toggle view should contain only **Garagentor**, with no light selection in its dropdown.
3. Open the button view. **Licht** should appear with a lamp icon beside the garage-door ventilation button. Switch it on and off and check its reported state.
4. Try opening, closing, stopping and ventilation. Travel completes after 1.2 seconds. Stopping during travel leaves the reported garage-door position unknown.
5. Create test Flows with **Garagenlicht einschalten**, **Garagenlicht ausschalten** and **Garagenlicht umschalten**. Check that the light button follows each result and the door position remains unchanged. Check **Garagenlicht ist eingeschaltet/ausgeschaltet** and the triggers **Garagenlicht wurde eingeschaltet** / **Garagenlicht wurde ausgeschaltet** against the same state. An unknown light state must not be treated as off by toggle or the condition.
6. Test **Garagentorposition ist** and **Garagentorposition hat sich geändert** while opening, closing or using **Garagentor in Lüftungsposition fahren**. The position-change trigger exposes the reported position token (`closed`, `open`, `ventilation` or `unknown`). These custom-capability triggers use Homey's automatic event handling.
7. Check an existing standard **Einschalten**, **Ausschalten** or **Ein- oder ausschalten** light Flow. These native cards still work and keep their existing names, even though the native light toggle is hidden. Restore the simulated light to off after testing.
8. In the device's Quick Action settings, inspect/select the light action if offered by the installed Homey version. Homey provides one quick-action slot on a standard device tile; the light button belongs inside the existing device.

The native `onoff` capability remains for Flow compatibility and shared light state. Only its device-view component is hidden with a scoped `uiComponent: null` option. A live probe on Homey 13.5.1 confirmed the door-only toggle view, light/ventilation button view and retained native Flow cards. The override has not been verified on older supported Homey versions.

All simulated values reset to closed/light-off when the demo app restarts. The demo can be uninstalled independently when finished. A successful UI test verifies the Homey presentation and simulated command/state path, not physical Hörmann operation or radio transport.
