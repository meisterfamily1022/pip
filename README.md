# Pip

Pip is a local-first family toy library. Less deciding. More playing. Parents photograph and organize toys by room and storage spot; Child Mode offers a deliberately simple, picture-led way to choose and return a toy.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run ios
npm run android
npm run web
```

## Local data and media

Pip stores its SQLite database and toy photos on the device. Photos selected or captured in the native app are copied into Pip-managed storage before a toy is saved. On web, selected blob URLs are converted to durable data URLs before persistence, so they survive an app reload while browser storage remains intact.

## Image intake

The Add Toys screen supports one-photo entry and multi-select intake. Bulk photos share the selected location, categories, and cleanup details; each becomes a separate editable toy. An embedded camera is available in Expo Go and iOS/Android devices, plus compatible secure-context browsers. Device simulators and browsers without an available camera show the permission/unavailable path; selecting a photo remains available.

See [the product-quality audit](docs/PRODUCT-QUALITY-AUDIT-2026-07-29.md) for current technical and platform considerations.

## Review and reset data

Settings includes a confirmed **Reset Pip** action that removes family data, managed photos, play history, settings, and the parent PIN without touching project source files. The old Expo starter `reset-project` source-deletion command is intentionally not available.

`seedReviewFixture` in `src/features/testing/review-fixture.ts` provides deterministic, idempotent rooms, storage spots, and toy states for automated review environments. It is not connected to production UI.
