# Third-party notices

OpenCCU for Homey preserves the Git history and MIT license of the original `LRuesink-WebArray/homey-matic` project. The root [LICENSE](LICENSE) retains its copyright notice.

## Runtime dependency

`homematic-xmlrpc` 1.0.2 is distributed under the MIT License and includes the notice:

> Copyright (c) 2011 Brandon Ace Alexander

Its complete license text is installed and packaged as `node_modules/homematic-xmlrpc/LICENSE`. The package depends at runtime on `sax` 0.4.x and a pinned `xmlbuilder` revision; their bundled package metadata and license notices remain in the packaged dependency tree.

## Design references

`aiohomematic` and `homematicip_local` are MIT-licensed design references only and are not runtime dependencies. Reference revisions and the aspects studied are recorded in [DEVICE_SUPPORT.md](DEVICE_SUPPORT.md) and [ARCHITECTURE.md](ARCHITECTURE.md). No Python runtime or copied Python source is included.

## Device artwork

Product-specific SVGs and PNGs retained or restored from the imported `homey-matic` history remain covered by that repository's MIT license and attribution. The 39 restored PNG pairs are byte-for-byte copies from imported ancestor `e7a16bb12dca80bad04e0527870f5a64ed03ef28`, completing the 45 exact-model image pairs available there. No downloaded OCCU/HMSL files are used.

New schematic SVG drawings and PNGs generated from them are original project artwork under this repository's MIT license. `scripts/generate-device-artwork.mjs` records their geometry and model assignment; it does not trace or embed manufacturer images. These drawings communicate device form/function and are not manufacturer photographs. The generic driver's neutral fallback remains original project artwork. Family-local SVG copies retain the same source and license as their corresponding driver icons.

The MIT-licensed `homematicip_local` integration was reviewed for icon semantics at commit `d12c643d7dbd922d419b8fa0eb40084add28af72`. No Home Assistant or Material Design artwork is copied into this repository.

OpenCCU's OCCU WebUI product PNGs are governed by the eQ-3 HomeMatic Software License (HMSL). They are deliberately not copied, traced, converted, packaged, or fetched at runtime by this app.

## App branding

The app's branselbytes circuit monogram is project-authored SVG artwork based on the owner-selected concept. The navy/copper smart-home scene was generated with OpenAI's built-in image generation tool and is illustrative project branding, not manufacturer product photography. Its source image, approved concept and production prompts are retained in `docs/design/branding/`, outside the Homey package. The SVG and generated app imagery are provided under this repository's MIT license to the extent applicable. The new branding does not replace or alter original-project copyright notices or the imported Git history.
