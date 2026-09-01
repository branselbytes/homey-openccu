# AGENTS.md

## Scope

This repository contains the Homey Pro app **OpenCCU for Homey** (`io.github.branselbytes.openccu`). It communicates locally with OpenCCU and targets the current Homey Apps SDK v3.

## Working rules

- Preserve the MIT license, copyright notices, and imported Git history.
- Keep `upstream` pointed at `LRuesink-WebArray/homey-matic`; never push there.
- Do not push, publish, create releases, or change external systems without explicit approval.
- Prefer TypeScript with strict types for new code. Modernize incrementally; do not combine mechanical migration with behavioral changes.
- Keep XML-RPC as the required device/control/event transport. Use JSON-RPC for CCU metadata and hub features. MQTT must remain optional.
- Do not add Home Assistant, Python, CCU-Jack, RedMatic, or MQTT as a required runtime dependency.
- Treat `aiohomematic` and `homematicip_local` as MIT-licensed design references only. Adapt concepts; do not copy substantial code without attribution and license review.
- Separate transport, OpenCCU domain model, capability mapping, Homey drivers, and diagnostics.
- Prefer generic discovery and profiles over one copied driver per product type.
- Never log credentials. Redact secrets and user-sensitive values from diagnostic exports.

## Quality gate

Before handing off a change, run the relevant formatter, lint, type-check, unit tests, Homey validation, and (when possible) an integration test against a recorded or dedicated OpenCCU fixture. Document commands and any checks that could not run.

## Documentation

Keep `ARCHITECTURE.md` aligned with architectural decisions and `IMPLEMENTATION_PLAN.md` aligned with delivery status. Record consequential decisions as short ADRs when implementation begins.
