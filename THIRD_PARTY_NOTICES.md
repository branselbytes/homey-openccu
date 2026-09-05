# Third-party notices

OpenCCU for Homey preserves the Git history and MIT license of the original `LRuesink-WebArray/homey-matic` project. The root [LICENSE](LICENSE) retains its copyright notice.

## Runtime dependency

`homematic-xmlrpc` 1.0.2 is distributed under the MIT License and includes the notice:

> Copyright (c) 2011 Brandon Ace Alexander

Its complete license text is installed and packaged as `node_modules/homematic-xmlrpc/LICENSE`. The package depends at runtime on `sax` 0.4.x and a pinned `xmlbuilder` revision; their bundled package metadata and license notices remain in the packaged dependency tree.

## Design references

`aiohomematic` and `homematicip_local` are MIT-licensed design references only and are not runtime dependencies. Reference revisions and the aspects studied are recorded in [DEVICE_SUPPORT.md](DEVICE_SUPPORT.md) and [ARCHITECTURE.md](ARCHITECTURE.md). No Python runtime or copied Python source is included.
