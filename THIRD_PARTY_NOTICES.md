# Third-party notices

OpenCCU for Homey preserves the Git history and MIT license of the original `LRuesink-WebArray/homey-matic` project. The root [LICENSE](LICENSE) retains its copyright notice.

## Runtime dependency

`homematic-xmlrpc` 1.0.2 is distributed under the MIT License and includes the notice:

> Copyright (c) 2011 Brandon Ace Alexander

Its complete license text is installed and packaged as `node_modules/homematic-xmlrpc/LICENSE`. The package depends at runtime on `sax` 0.4.x and a pinned `xmlbuilder` revision; their bundled package metadata and license notices remain in the packaged dependency tree.

## Design references

`aiohomematic` and `homematicip_local` are MIT-licensed design references only and are not runtime dependencies. Reference revisions and the aspects studied are recorded in [DEVICE_SUPPORT.md](DEVICE_SUPPORT.md) and [ARCHITECTURE.md](ARCHITECTURE.md). No Python runtime or copied Python source is included.

## Device artwork

Product-specific SVGs retained from the imported `homey-matic` history remain covered by that repository's MIT license and attribution. The neutral fallback used where no imported product artwork exists is original project artwork under the repository's MIT license.

The MIT-licensed `homematicip_local` integration was reviewed for icon semantics at commit `d12c643d7dbd922d419b8fa0eb40084add28af72`. No Home Assistant or Material Design artwork is copied into this repository.

OpenCCU's OCCU WebUI product PNGs are governed by the eQ-3 HomeMatic Software License (HMSL). They are deliberately not copied, traced, converted, packaged, or fetched at runtime by this app.
