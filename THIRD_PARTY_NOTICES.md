# Third-party notices

OpenCCU for Homey preserves the Git history and MIT license of the original `LRuesink-WebArray/homey-matic` project. The root [LICENSE](LICENSE) retains its copyright notice.

## Runtime dependency

`homematic-xmlrpc` 1.0.2 is distributed under the MIT License and includes the notice:

> Copyright (c) 2011 Brandon Ace Alexander

Its complete license text is installed and packaged as `node_modules/homematic-xmlrpc/LICENSE`. The package depends at runtime on `sax` 0.4.x and a pinned `xmlbuilder` revision; their bundled package metadata and license notices remain in the packaged dependency tree.

## Design references

`aiohomematic` and `homematicip_local` are MIT-licensed design references only and are not runtime dependencies. Reference revisions and the aspects studied are recorded in [DEVICE_SUPPORT.md](DEVICE_SUPPORT.md) and [ARCHITECTURE.md](ARCHITECTURE.md). No Python runtime or copied Python source is included.

The HmIP-MOD-HO review uses `aiohomematic` at `3ced0fd3c9e9f741978dc5e079a1fc145396c481` and `homematicip_local` at `2a49f5484b6f9da6673a8d136fc87449b29980cc` (MIT, copyright 2021–2026 SukramJ and Daniel Perna), plus `pydevccu` device metadata at `6fe7695f049219c77cbda2b60131fdf61d836000` (MIT, copyright 2019–2026 Daniel Perna, SukramJ and contributors). These sources were studied for command/state semantics; no implementation or fixture was copied from them. The new fixture derives from the anonymized issue report, and the TypeScript implementation and capability SVGs are project-authored. See [ADR 0023](docs/adr/0023-hoermann-controls-and-support-diagnostics.md).

## Device artwork

Product-specific SVGs and PNGs retained or restored from the imported `homey-matic` history remain covered by that repository's MIT license and attribution. The 39 restored PNG pairs are byte-for-byte copies from imported ancestor `e7a16bb12dca80bad04e0527870f5a64ed03ef28`, completing the 45 exact-model image pairs available there. No downloaded OCCU/HMSL files are used.

New schematic SVG drawings and PNGs generated from them are original project artwork under this repository's MIT license. `scripts/generate-device-artwork.mjs` renders geometry and model assignments from `scripts/device-artwork-electrical.mjs`, `scripts/device-artwork-household.mjs` and `scripts/device-artwork-sensors.mjs`; it does not trace or embed manufacturer images. Those modules record references used to understand physical form. These drawings communicate device form/function and are not manufacturer photographs or wiring instructions. The generic driver's neutral fallback remains original project artwork. Family-local SVG copies retain the same source and license as their corresponding driver icons.

The MIT-licensed `homematicip_local` integration was reviewed for icon semantics at commit `d12c643d7dbd922d419b8fa0eb40084add28af72`. No Home Assistant or Material Design artwork is copied into this repository.

OpenCCU's OCCU WebUI product PNGs are governed by the eQ-3 HomeMatic Software License (HMSL). They are deliberately not copied, traced, converted, packaged, or fetched at runtime by this app.

The [2026-10-03 license review](docs/design/device-artwork-license-review.md) confirms that manufacturer assets from OpenCCU-Base can be reused conditionally under HMSL; this is separate from OpenCCU's own graphics permission notice and from MIT licensing of extractor code such as `openccu-data`. This refresh chooses original SVGs rather than adding those asset-specific terms and distribution arrangements. It does not claim that HMSL assets are categorically unusable in a MIT app.

## App branding

The app's branselbytes circuit monogram is project-authored SVG artwork based on the owner-selected concept. The navy/copper smart-home scene was generated with OpenAI's built-in image generation tool and is illustrative project branding, not manufacturer product photography. Its source image, approved concept and production prompts are retained in `docs/design/branding/`, outside the Homey package. The SVG and generated app imagery are provided under this repository's MIT license to the extent applicable. The new branding does not replace or alter original-project copyright notices or the imported Git history.
