# Release checklist

This checklist prepares a release but does not authorize pushing, publishing, tagging, repository changes, or Homey App Store submission.

## Scope and compatibility

- [x] Document the intended Homey Pro generations, minimum Homey version, and current OpenCCU test point.
- [ ] Hardware-verify each Homey/OpenCCU combination claimed for release in `COMPATIBILITY.md`.
- [x] Confirm HmIP-RF device scope plus HmIP heating groups through VirtualDevices; document deferred features.
- [x] Review `DEVICE_SUPPORT.md`; clearly distinguish fixture-tested from hardware-tested products.
- [ ] Exercise fresh installation, restart, upgrade, device deletion, and re-pairing.

## Quality and security

- [x] Run `npm ci` from a clean checkout.
- [x] Run `npm run check`, `npm run build`, and `npx homey app validate --level publish`.
- [x] Before installation, rebuild the complete production package and verify its runtime dependencies. Homey CLI 4.4.4's standalone `app validate` recreates `.homeybuild` without JavaScript dependencies; do not install that directory unchanged. Use the normal install/publish preprocessing, or run `App.preprocess()` followed by `App._validate({ level: "publish" })` without another standalone validation command.
- [x] Run `npm audit --omit=dev` and review the complete dependency tree and licenses.
- [x] Review and disposition development-only Homey CLI audit findings; do not accept a CLI downgrade as an automatic fix.
- [x] Verify the packaged archive contains no extraneous modules, credentials, captures, caches, or generated diagnostics.
- [x] Recheck callback source filtering, credential handling, log privacy, diagnostic redaction, and LAN-only guidance.
- [x] Measure regular-process idle/load memory and CPU without the remote inspector.

## Integration

- [ ] Test XML-RPC discovery, commands, delayed acknowledgement, read-back, and push callbacks.
- [ ] Test JSON-RPC names, rooms, functions, programs, and system variables.
- [ ] Test OpenCCU outage/restart and Homey app restart/reconnect.
- [ ] Test a dedicated driver and the generic fallback with recorded redacted fixtures.
- [ ] Verify optional program/variable writes only against disposable test objects.

## Documentation and release control

- [x] Add an initial changelog that clearly marks the current work as unreleased.
- [x] Update README, architecture, implementation plan, troubleshooting, support matrix, and changelog.
- [x] Prepare a beta-testing guide, sanitized device-report template, and forum announcement draft.
- [x] Verify diagnostics creation plus file and clipboard export in the Homey settings view.
- [x] Confirm root MIT history/license preservation and `THIRD_PARTY_NOTICES.md`.
- [x] Review settings and user-facing strings in supported languages.
- [x] Obtain explicit project-owner approval for the public GitHub push and Homey App Store Draft upload.
- [x] Submit Draft build 1 for initial certification without automatic Live publication.
- [ ] Obtain separate approval before Test/Live activation, tagging, GitHub release creation, or forum publication.

## Current 0.1.0 audit snapshot

The release audit includes a clean locked install and, as of 2026-09-07, the subsequently extended suite of all 252 tests, formatting, lint, strict TypeScript checks, Homey build, and publish-level validation. The production dependency audit reports zero vulnerabilities. The runtime tree contains only `homematic-xmlrpc`, `sax`, and `xmlbuilder`; all declare MIT licenses. Development-only findings remain isolated to the Homey CLI toolchain as documented in the implementation plan.

The public GitHub repository now contains the preserved history on `main`. Homey App Store version `0.1.0`, Draft build 1, was submitted for initial certification without automatic Live publication and is currently under review. It has not been activated as Test/Live.

Package inspection found no credentials, captures, caches, generated diagnostics, private keys, or environment files. Development documentation, configuration, and source maps are excluded from the install archive; the root MIT license, third-party notice, and dependency licenses remain packaged. This snapshot does not complete the open hardware and compatibility gates above.

## 0.1.1 upload preparation (2026-09-08)

The owner authorized committing and pushing the current work to GitHub and uploading it to Athom. Version 0.1.1 includes Wired DRS8/DRI16/DRAP/SPI support and the SWO-PR compass display. All 286 tests, formatting, lint, type checks, and Homey publish validation passed. Local credentials are excluded from Git and explicitly omitted from Athom build environment variables. Recorded test fixtures are excluded from the app package. The 0.1.0 build remains under certification review; this upload prepares a separate Draft without Test/Live activation.

Athom upload completed: [version 0.1.1, Build 2](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/2). No Test/Live activation was performed.

## 0.1.2 installation and Developer upload (2026-10-03)

The owner authorized installation on Homey Christian, a Git commit and origin/main push, and the Homey CLI Developer upload. Version 0.1.2 combines the SWDO family and adds SWDO-A support; its changelog also includes the detection controls and widget typography changes since the previous Developer build. `npm run check` passed formatting, lint, strict types and all 317 tests; Homey build and publish-level validation passed.

The CLI installed 0.1.2 on Homey Christian without clearing app data. Verification on Homey 13.5.0 confirms running/enabled/not crashed, all 13 existing devices available with their original identities and retained capabilities, and healthy CCU discovery (35 devices, zero issues). SWDO-A is recognized by the shared contact profile; its physical pairing and event test remain pending.

[Homey Developer Build 3](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/3) uploaded successfully and was confirmed as version 0.1.2 in draft state. The build environment contains zero keys; local CCU credentials and env.json were excluded. No Test/Live activation or Git tag was created.

## 0.1.3 update preparation (2026-10-03)

The owner authorized preparing the next update, committing/pushing to origin/main and uploading to Homey Developer. Version 0.1.3 includes shared PS/PSM and eTRV pairing, PSM-2/-2-A and Wired STH/-A profiles, inventory/cache fixes, corrected device imagery, family pairing icons, the selected branselbytes branding and donation metadata. Existing device identities, bindings and legacy adapters remain in place.

All 409 tests in 58 files, formatting, ESLint, production/test TypeScript checks, TypeScript build, Homey build and publish-level validation passed. The production dependency audit reports zero vulnerabilities. The package includes 156 driver PNGs, 13 family SVGs and four app branding assets; source designs, recorded fixtures, scripts, coverage and env.json are excluded. Package/working-tree inspection found no local private configuration values. MIT notices and imported history remain intact.

The Developer upload must use an explicitly empty build environment. Physical PSM-2/STH commands, the family upgrade, new pairing and actual add/remove notifications remain the documented hardware checks. This upload does not install the app on a Homey or activate Test/Live, create a tag or create a GitHub release.

Upload completed: source commit [86fff77](https://github.com/branselbytes/homey-openccu/commit/86fff77) was pushed to origin/main, and [Homey Developer Build 4](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/4) was uploaded successfully. A read-only Developer API check confirms version 0.1.3, state `draft` and zero build environment keys. The CLI packaged 577 files into a 7.31 MB archive. No Homey installation, Test/Live activation, tag or GitHub release was performed.

Installation follow-up (2026-10-03): the owner subsequently confirmed Test publication and authorized installing 0.1.3 on Homey Christian and Homey Eltern. Both were updated through `installFromAppStore` with channel `test` and exact version `0.1.3`. Both report running/enabled/not crashed on Homey 13.5.0. All 17 Christian and six Eltern app devices remain available with preserved IDs, driver assignments and existing capabilities. CCU diagnostics are healthy, discovering 35/20 devices with zero issues. Automatic updates remain enabled, and both installations now originate from the App Store Test channel. This resolves the earlier Eltern CLI multipart-upload blocker without changing local CCU configuration or sending physical device commands. The older, separately named Eltern Homey Pro was not targeted.

## 0.1.4 installation and Developer upload (2026-10-03)

The owner authorized the next version, installation on Homey Christian and transfer to Homey Developer. Version 0.1.4 includes the Hörmann controls/Flow cards and unknown-position callback fix, bounded diagnostic summaries and safe CCU fault codes, revised device artwork, native-style widgets and the English/German Store descriptions with corrected Flow catalog metadata. The original reported Hörmann write rejection is still unconfirmed on hardware.

With Node.js 22.23.3, `npm run check` passed formatting, ESLint, production/test TypeScript checks and all **535 tests in 65 files**, including recorded/synthetic device fixtures. `npm run build`, `homey app build` and `homey app validate --level publish` passed. The final production package was rebuilt with `App.preprocess()` and validated in place through `App._validate({ level: "publish" })`; `homematic-xmlrpc`, `sax` and `xmlbuilder` were explicitly checked inside the package. The archive contains **582 files, 7.26 MB**. Local credentials and environment files are excluded, and installation/upload both used an explicitly empty environment.

The Cloud relay rejected the initial direct upload with HTTP 400. Local installation then exposed a packaging mistake: the standalone validation command had removed the runtime dependencies from `.homeybuild`, so that first package crashed at startup. Rebuilding the complete package and reinstalling through the local connection resolved the startup failure without clearing app data. Post-install checks confirm **0.1.4 running/enabled/not crashed** on Homey Christian, firmware 13.5.0, with all **17 devices available**, preserved IDs/driver assignments/existing capabilities, healthy CCU discovery of 35 devices and zero discovery, metadata, system-information, RPC or timeout failures. Installation origin is `devkit_install`; automatic updates remain enabled. No physical control command was sent.

[Homey Developer Build 5](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/5) uploaded successfully. A read-only Developer API check confirms version **0.1.4**, state **draft**, **zero environment keys**, two widgets and all ten custom Flow cards. Both English/German descriptions and changelogs exactly match the local release files. Test/Live activation, Git push, tagging and GitHub release creation were not part of this delivery. Physical Hörmann commands, final public Store rendering and actual Homey widget/icon rendering remain open checks.

The Developer catalog contains exactly the 70 non-deprecated drivers from the 78-driver local manifest, with matching capability lists and all three new Hörmann Flow IDs. An isolated import of the packaged production dependencies and an XML parser smoke test passed without resolving modules from the project directory. Final read-only Homey checks after the upload again confirmed 0.1.4 running and all 17 devices available. Post-upload formatting and `git diff --check` passed.

## Heating editor development installation (2026-10-04)

The owner requested installation of the current working tree on Homey Christian. The new heating editor remains an unreleased development update with version 0.1.4. All 627 tests, formatting, lint, strict types, build and publish-level package validation passed before installation. A separate package audit confirmed current compiled sources, all thirteen repair views and their local editor assets, complete production dependencies and absence of credentials or test fixtures. The 628-file, 7.69 MB package was installed locally with preserved app data and an explicitly empty environment.

Read-only verification confirms running/enabled/not crashed, 17/17 available devices with preserved IDs, drivers and capabilities, and healthy discovery of 35 CCU devices without reported transport or discovery failures. The new Homey heating API successfully reads the paired group's six stored weekly profiles and separately reports three selectable profiles. No heating profile was written. Native editor interaction and physical write delivery remain pending; this installation did not upload a Developer build or activate a Store release.

## Heating editor memory correction (2026-10-04)

The owner reported a crash and "Memory Warning Limit Reached" when opening/reloading heating profiles. Investigation reproduced 129–156 MB PSS and warning-limit restarts even before the first profile read. The corrected build replaces description-cache writes through Homey settings with a bounded process-local cache and reduces large profile-response allocations through bounded metadata reuse, coalescing and sequential reads. Fresh metadata validation remains mandatory for saves and read-back. ADR 0026 records the evidence and limits.

All **657 tests in 72 files**, formatting, ESLint, application/test type checks, full production preprocessing and in-place publish validation passed. The complete 630-file, 7.7 MB development package was installed on Homey Christian with preserved app data and an empty environment; version remains 0.1.4.

Live verification sampled **33.8–48.7 MB PSS** through 396 seconds uptime, including a cold read, ten refreshes, eight simultaneous requests and a read after the five-minute metadata expiry. A second deliberate app restart and cold read sampled **34.4–44.0 MB** through 82 seconds. Both runs completed with **zero memory warnings or unintended restarts**. Final read-only checks confirm running/enabled/not crashed, all **17 devices available and preserved**, healthy discovery of 35 CCU devices with no reported failures, and six readable weekly profiles. This validates the reproduced workload, not indefinite stability. No heating schedule write, Developer upload or Store release was performed.

Compact-view follow-up (2026-10-04): the owner requested clearer heating profiles and reduced spacing. Localized weekday buttons, changed-day indicators, compact interval rows and expandable guidance/copying tools now reduce the narrow three-interval fixture's height by about half. All **658 tests**, formatter/lint/types, production build and publish validation passed; **437 synthetic-browser assertions** cover both entry points/languages/themes, narrow/wide screens, larger text, maximum intervals and existing save safeguards. Shared assets match all thirteen generated repair views and the packaged copies. The updated **630-file, 7.76 MB** development package was installed on Homey Christian without clearing app data. Read-only checks confirm all **17 devices preserved and available**, healthy CCU transport and readable profiles. Observation through 115 seconds uptime recorded **47.1–48.1 MB PSS with zero memory warnings or restarts**. Version remains 0.1.4; no physical schedule writes or Developer/Store upload were performed. Actual native-host rendering remains for owner feedback; the visual checks use a synthetic Homey bridge.

## 0.1.5 release preparation (2026-10-04)

The owner authorized committing the current work, preparing 0.1.5, transferring it to Homey Developer and installing it on Homey Eltern. The release contains the weekly editor, compact mobile presentation, bounded description/schema caches and memory-warning diagnostics. English/German Store descriptions and release notes are current. All 658 tests, formatter/lint/types, full production preprocessing and in-place publish validation passed. Installation must preserve existing app data and both installation/upload must use an empty environment; public Test/Live activation and Git push are outside this delivery.

Delivery status: source commit `0776a49`; [Developer Build 6](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/6) uploaded and verified as 0.1.5/draft with zero environment keys, exact DE/EN text matches, both widgets and all ten custom Flow cards. The full 630-file/7.76 MB package is installed on Christian with 17/17 devices preserved and available, healthy CCU transport, readable profiles and zero memory warnings. Eltern's direct Cloud upload fails with `Unexpected end of form` even with exact-length buffered multipart; no direct LAN/forwarded route is available. Its Store installer rejects the unpublished 0.1.5 with `build_not_found`. Eltern remains on 0.1.4 while the owner decides whether to promote the concrete Build 6 to Test for Store installation. No Test/Live promotion, Git push or physical schedule write was performed.

## 0.1.5 Test publication and Eltern installation (2026-10-04)

The owner subsequently explicitly approved publishing Build 6 in the Test channel and updating Homey Eltern. The channel transition completed and a read-only check confirms version 0.1.5, state `test`, zero environment keys, unchanged German/English descriptions and changelogs, two widgets, ten custom Flow cards and 70 Store drivers. The exact 0.1.5 Test version was then installed on Homey Eltern through `installFromAppStore` with `waitForInstall: true`; the installer reported completion. This resolves the earlier direct Cloud multipart blocker through the supported Store installation path. No Live activation, Git push or physical heating command was performed.

Verification completed: Eltern required several minutes for initial discovery, then reported **six of six devices available**, unchanged IDs/drivers/capabilities, and **20 CCU devices with a healthy connection** in two separate checks. Startup recorded five `getParamsetDescription` timeouts; this count remained unchanged after discovery and the request queue was empty. At 387 seconds uptime, PSS was **72.0 MB**, with **zero memory warnings and no unintended restart**. No heating targets are paired on Eltern, so profile reading was not applicable there. Christian remains healthy at 0.1.5 with all **17 devices available**, preserved identities and readable heating profiles. This completes the authorized Test publication and installation; physical device writes were not required for validation.

The final fresh check at 406 seconds reports 72.2 MB PSS, zero memory warnings and all six devices available. Two nonfatal discovery issues remain alongside the five startup timeouts; metadata issues are zero. Their specific descriptors are not exposed by the support report. These remaining discovery diagnostics must not be described as zero transport/discovery failures.

## 0.1.6 beta authorization (2026-10-04)

The owner accepted the garage UI simulation and explicitly authorized committing first, GitHub beta publication, Homey Test-channel publication via CLI and an in-place production update on Homey Christian. Version 0.1.6 contains the garage light button, explicit light/door Flow cards and alias/read-back synchronization; it does not introduce the pre-existing transport queue. Preserve existing devices and Flows, publish GitHub as a prerelease, use an empty build environment and keep Homey publication on Test. No forum post or Live-channel promotion is requested.

Publication completed: release commit [`1c61da4`](https://github.com/branselbytes/homey-openccu/commit/1c61da4) was created before deployment and pushed to origin/main with annotated tag `v0.1.6`. The [GitHub prerelease](https://github.com/branselbytes/homey-openccu/releases/tag/v0.1.6) is public. A clean checkout of this tag, without `env.json`, was uploaded using `HOMEY_HEADLESS=1 homey app publish`. [Homey Developer Build 7](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/7) contains version 0.1.6, matching English/German release notes and zero environment keys, and was promoted to Test. The archive contains 631 files (7.77 MB). No Live promotion or upstream push was performed.

The exact 0.1.6 Test build was installed on Homey Christian through `homey api raw`, posting the Store installation request with version/channel and preserving app data. Verification at 38 seconds uptime confirms running/enabled/not crashed, App Store Test origin, automatic updates enabled, and all 17 existing device identities, driver assignments and prior capabilities retained with 17/17 available. The CCU reports a healthy connection, 35 discovered devices, zero discovery/metadata/system issues, zero failed/timed-out RPCs, an empty request queue and zero memory warnings. No physical actuator or heating schedule was changed. The isolated garage demo remains separate.

CLI note: in Homey CLI 4.4.4, `api apps install-from-app-store --version 0.1.6` was consumed by the global CLI version flag and only printed the CLI version. Use `homey api raw --method POST --path /api/manager/apps/store --body @request.json` with the exact app/version/channel in JSON, or the authenticated SDK method, and verify the installed version independently.

0.1.7 delivery completed: source commit [`6cbe90d`](https://github.com/branselbytes/homey-openccu/commit/6cbe90d) and annotated tag `v0.1.7` were pushed to origin; the [GitHub prerelease](https://github.com/branselbytes/homey-openccu/releases/tag/v0.1.7) is public and its CI passed. A clean tagged checkout was uploaded through `HOMEY_HEADLESS=1 homey app publish`. [Homey Build 8](https://tools.developer.homey.app/apps/app/io.github.branselbytes.openccu/build/8) was verified for version, all three new conditions, matching EN/DE changelog and zero environment keys, then promoted to Test. The archive contains 632 files (7.78 MB). Issues [#1](https://github.com/branselbytes/homey-openccu/issues/1) and [#2](https://github.com/branselbytes/homey-openccu/issues/2) were commented with resolution evidence and closed as completed.

The exact 0.1.7 Test build was installed on Homey Christian via the CLI raw Store request, preserving app data. Verification at 41 seconds uptime confirmed running/not crashed, App Store Test origin, automatic updates enabled, all 17 existing IDs/drivers/capabilities preserved and 17/17 available. CCU discovery is healthy with 35 devices and zero discovery, metadata, system, RPC or timeout failures; memory warnings are zero. No physical control command or schedule write was performed. The handle conditions were integration-tested with simulated states; a physical handle test remains outside this delivery.
