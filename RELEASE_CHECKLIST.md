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
- [ ] Update README, architecture, implementation plan, troubleshooting, support matrix, and changelog.
- [x] Prepare a beta-testing guide, sanitized device-report template, and forum announcement draft.
- [x] Verify diagnostics creation plus file and clipboard export in the Homey settings view.
- [x] Confirm root MIT history/license preservation and `THIRD_PARTY_NOTICES.md`.
- [x] Review settings and user-facing strings in supported languages.
- [ ] Obtain explicit project-owner approval before any push, tag, GitHub release, publication, or submission.

## Current 0.1.0 audit snapshot

The release audit includes a clean locked install and, as of 2026-09-07, the subsequently extended suite of all 252 tests, formatting, lint, strict TypeScript checks, Homey build, and publish-level validation. The production dependency audit reports zero vulnerabilities. The runtime tree contains only `homematic-xmlrpc`, `sax`, and `xmlbuilder`; all declare MIT licenses. Development-only findings remain isolated to the Homey CLI toolchain as documented in the implementation plan.

Package inspection found no credentials, captures, caches, generated diagnostics, private keys, or environment files. Development documentation, configuration, and source maps are excluded from the install archive; the root MIT license, third-party notice, and dependency licenses remain packaged. This snapshot does not complete the open hardware and compatibility gates above.
