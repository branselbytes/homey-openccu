# Release checklist

This checklist prepares a release but does not authorize pushing, publishing, tagging, repository changes, or Homey App Store submission.

## Scope and compatibility

- [ ] Confirm the intended Homey Pro generations, minimum Homey version, and supported OpenCCU versions.
- [ ] Confirm HmIP-RF-only scope and document deferred features.
- [ ] Review `DEVICE_SUPPORT.md`; clearly distinguish fixture-tested from hardware-tested products.
- [ ] Exercise fresh installation, restart, upgrade, device deletion, and re-pairing.

## Quality and security

- [ ] Run `npm ci` from a clean checkout.
- [ ] Run `npm run check`, `npm run build`, and `npx homey app validate --level publish`.
- [ ] Run `npm audit --omit=dev` and review the complete dependency tree and licenses.
- [ ] Review and disposition development-only Homey CLI audit findings; do not accept a CLI downgrade as an automatic fix.
- [ ] Verify the packaged archive contains no extraneous modules, credentials, captures, caches, or generated diagnostics.
- [ ] Recheck callback source filtering, credential handling, log privacy, diagnostic redaction, and LAN-only guidance.
- [ ] Measure regular-process idle/load memory and CPU without the remote inspector.

## Integration

- [ ] Test XML-RPC discovery, commands, delayed acknowledgement, read-back, and push callbacks.
- [ ] Test JSON-RPC names, rooms, functions, programs, and system variables.
- [ ] Test OpenCCU outage/restart and Homey app restart/reconnect.
- [ ] Test a dedicated driver and the generic fallback with recorded redacted fixtures.
- [ ] Verify optional program/variable writes only against disposable test objects.

## Documentation and release control

- [ ] Update README, architecture, implementation plan, troubleshooting, support matrix, and changelog.
- [ ] Confirm root MIT history/license preservation and `THIRD_PARTY_NOTICES.md`.
- [ ] Review settings and user-facing strings in supported languages.
- [ ] Obtain explicit project-owner approval before any push, tag, GitHub release, publication, or submission.
