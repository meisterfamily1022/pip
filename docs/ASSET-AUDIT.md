# Pip Asset Audit

Current app configuration:

- Display name: Pip
- Slug: `playmap-mobile`
- Version: `1.0.0`
- iOS build number: `1`
- Orientation: default (phone and tablet rotation supported)
- iPhone support: yes
- iPad support: enabled
- Bundle identifier: `com.meister23.playmapmobile`

Canonical Pip assets:

- Approved immutable source: `assets/brand/source/pip-logo-approved.svg`
- Deterministic generator: `npm run assets:pip`
- Generated lockup, wordmark, symbol, opaque iOS icon, transparent Android foreground, splash, favicon, and social preview: `assets/brand/generated/`
- Expo configuration points directly to the generated Pip assets.
- `public/pip-preview.png` and `public/pip-icon.png` support web previews and touch icons.

Legacy assets retained but no longer referenced by app configuration:

- `assets/expo.icon`
- Expo/React tutorial graphics under `assets/images/`
- Android background and monochrome placeholders. Pip uses a cream adaptive-icon background color and the approved full-color symbol foreground; no recolored monochrome variant is generated.

Owner decisions still required:

- Final legal owner/seller name.
- Final bundle identifier.
- Privacy policy public URL.
- Support public URL or support email.
- Whether iPad support should remain enabled for V1.
