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

- Approved source: `assets/brand/source/pip-logo-approved.svg` — the redesigned
  wordmark, `pip` set lowercase in Quicksand Medium and converted to outlines so
  it rasterises identically without the font installed.
- Deterministic generator: `npm run assets:pip`
- Generated lockup, wordmark, compact mark, opaque iOS icon, transparent Android
  foreground, splash, favicon, and social preview: `assets/brand/generated/`
- Expo configuration points directly to the generated Pip assets.
- `public/pip-preview.png` and `public/pip-icon.png` support web previews and touch icons.
- The in-app mark is drawn as vectors by `src/components/pip-brand-mark.tsx`
  from the same geometry, so screens never load a raster logo.

Typefaces:

- Montserrat 400 and 700 carry the entire interface; Quicksand Medium is the
  logo wordmark and is never used for interface copy.
- Files live in `assets/fonts/` under the SIL Open Font Licence (`assets/fonts/OFL.txt`).
- Embedded natively by the `expo-font` config plugin and loaded at runtime by
  `useFonts` for web.

Legacy assets retained but no longer referenced by app configuration:

- `assets/expo.icon`
- Expo/React tutorial graphics under `assets/images/`
- Android background and monochrome placeholders. Pip uses a white adaptive-icon background colour and the approved full-colour mark as the foreground; no recoloured monochrome variant is generated.

Owner decisions still required:

- Final legal owner/seller name.
- Final bundle identifier.
- Privacy policy public URL.
- Support public URL or support email.
- Whether iPad support should remain enabled for V1.
