# Device artwork source review

Reviewed on 2026-10-03 for the device icon refresh. This records the upstream
notices and the project's asset selection decision; it does not establish a new
license grant.

## Result and decision

Manufacturer device PNGs from OpenCCU-Base are **conditionally reusable under
HMSL 2.0**. A MIT app can contain separately licensed assets; lack of an MIT or
Apache artwork license is not, by itself, a reason that reuse is impossible.
OpenCCU's own branding/artwork notice must be considered separately from the
manufacturer's grant for Base assets.

For this refresh, use original device silhouettes and illustrations from
project-authored SVG geometry. This is the user's authorized fallback and avoids
adding asset license conditions to this release. It also supplies the SVG icons
Homey needs: the upstream PNGs are not a direct replacement for those icons.
This decision does not mean that manufacturer PNG reuse is categorically
prohibited or that independent drawing is the only lawful option.

Existing artwork from the imported `homey-matic` history is a separate provenance
category documented in [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md).
This review neither changes those assets nor asserts additional rights to them.

## Findings

- **OpenCCU project graphics:** The main repository distinguishes its Apache-2.0
  code/distribution license from branding and artwork. Its artwork paragraph
  includes both the logo and other graphics, and states that reuse
  “is prohibited without prior written permission.” This applies to commercial
  and non-commercial reuse in that notice; it is not merely a restriction on the
  OpenCCU logo. This notice is not evidence that OpenCCU can withdraw rights
  granted separately by eQ-3 for eQ-3 assets obtained from the manufacturer's
  repository. See the [pinned README, license section](https://github.com/OpenCCU/OpenCCU/blob/1bd920b2bbf937f3965bf121997161546bbcbce6/README.md#scroll-licenses).
- **Device images in OpenCCU-Base:** Product PNGs live under
  `www/config/img/devices/50/` and `www/config/img/devices/250/`. The
  [manufacturer's component license overview](https://github.com/homematicip/OpenCCU-Base/blob/8471d969a3cefbfdfc95176a350d720342bc3122/licenses/licenses.md)
  defaults to HMSL 2.0. The Apache exceptions name `src/webui` and `webui`, not
  `www`; no image-directory license exception was found. The OpenCCU-maintained
  Base fork was also checked at `0cb30cb7b459402129233188ccbfc296f6e05d5a`.
- **Older OCCU source:** The corresponding device directories are
  `WebUI/www/config/img/devices/50/` and `WebUI/www/config/img/devices/250/` in
  `eq-3/occu`. Its [HMSL notice](https://github.com/eq-3/occu/blob/d9d7acbb37c29703f71c89cf3c1f62c390ddcfb2/LicenseDE.txt)
  is separate from OpenCCU's Apache license. Moving to that older source does not
  supply an MIT artwork grant.
- **New `openccu-data` package:** Its extractor code is MIT, but its
  [NOTICE](https://github.com/SukramJ/openccu-data/blob/932f7d7ea3ff24db4c186d7bd01fd547b9bfe457/NOTICE.md)
  expressly identifies `openccu_data/data/device_images/250/**/*.png` as
  unmodified copies from OpenCCU-Base that retain upstream licensing. Using that
  package would not change the image license. Its short claim that commercial
  redistribution requires permission is broader than the manufacturer's text;
  use that text for the actual conditions.

## Direct reuse requirements

The [manufacturer's HMSL 2.0](https://github.com/homematicip/OpenCCU-Base/blob/8471d969a3cefbfdfc95176a350d720342bc3122/licenses/HMSL2.txt)
provides the following conditions:

- Sections 3.1 and 3.3 allow use on third-party hardware and redistribution of
  unmodified copies if recipients are required to comply with HMSL and the full
  terms and rights notices accompany the copies.
- Section 3.2 permits modifications with their source published free under HMSL.
  Treat resizes and image-derived SVGs as modified assets: preserve the originals,
  publish editable outputs/conversion sources, and retain HMSL for those assets.
  Vectorization or AI conversion does not turn copied artwork into MIT artwork.
- Sections 3.5–3.8 reserve other intellectual-property rights and restrict
  high-risk use, adaptation for competing hardware, and misleading attribution.
  There is no general non-commercial-only rule. Free distribution and an eQ-3
  device focus therefore do not, by themselves, resolve all conditions.

The text does not expressly require independently authored, merely co-packaged
application code to be relicensed. Keeping assets clearly separate from MIT code
is a reasonable reading, not an asset-specific ruling by the rights holder.

For this app, direct reuse would require an exact asset/provenance inventory,
packaged full HMSL and copyright notices, correcting the existing artwork license
claims, and a suitable user-facing way to pass through the component terms.
Current packaging does not provide that setup. The effectiveness of passing those
terms through the Homey Store has not been established; do not assert that a
notice file alone settles it. These are concrete additional tasks, not a finding
that the Store necessarily prohibits HMSL assets.

## Image versus icon

Homey uses PNG driver images separately from the driver's `assets/icon.svg`.
Its [driver documentation](https://apps.developer.homey.app/the-basics/devices#icon)
and [design guidelines](https://apps.developer.homey.app/app-store/guidelines#1.5.-icons)
require a recognizable SVG icon with a transparent background. Reusing a product
PNG could improve the Store image, but would still leave SVG drawing or
conversion work. A fresh SVG designed from device form/function without copying
the source image's artwork remains the chosen approach here.

No upstream image files were added to the app. Written permission is an
alternative way to resolve uncertain asset/distribution conditions; HMSL itself
already grants conditional rights and should not be described as requiring
individual permission for every use.
