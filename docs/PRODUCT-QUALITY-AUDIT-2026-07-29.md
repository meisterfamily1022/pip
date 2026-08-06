# PlayMap product-quality audit

Audited 2026-07-29 before implementation. This audit covers the Expo Router app, local SQLite persistence, toy services, shared UI, every route, tests, configuration, and the Expo SDK 57 image-picker documentation.

## Navigation and routes

- Route groups and the startup destination are coherent, but the parent pages hide every native header without providing a consistent in-page back affordance.
- `edit-toy` accepts an invalid `id`, does a database query with `NaN`, and reports a generic error instead of returning to the library.
- The home, library, locations, settings, and forms use separate visual shells; navigation does not read as one product.

## UI, layout, responsiveness, and accessibility

- Screens duplicate typography, buttons, cards, inputs, error states, and page padding. The resulting controls have inconsistent visual weight and focus/pressed behavior.
- Parent forms have large unstructured option groups, while some parent pages lack `SafeAreaView` and tablet/desktop containment.
- Toy cards are flexible but do not have a deliberate phone/tablet/desktop grid system. Several headers and actions can crowd on narrow widths.
- The child screens are friendly, but their cards and primary actions are not consistently constrained at tablet widths.
- Most controls have roles/labels, but text inputs often omit `placeholderTextColor`, live status is inconsistent, selection controls use `button` instead of radio semantics, images are exposed as decorative labels rather than useful descriptions, and a loading/error state can replace the whole screen without a consistent recovery action.

## Image and camera handling

- `expo-image-picker` ~57.0.7 is already installed, configured with photo/camera messages, works in Expo Go, and is compatible with the SDK 57 app. No package is required.
- The existing form always takes only the first selected asset, does not support bulk selection, suppresses camera on the web, and does not handle picker errors, permission denial, cancellation, or Android pending picker results.
- SDK 57 supports `allowsMultipleSelection` on Android, iOS 14+, and web. Picker/camera entry points must be invoked directly from a press handler. Web browser cancellation may not be reported, so the UI must simply remain unchanged.
- Native images are copied into app-managed storage; web keeps an object/data URI. This preserves current local-only behavior but browser-session URIs are not durable across browser storage clearing/restarts.

## Toy creation, persistence, and transaction safety

- Single-toy creation validates all required fields and copies a photo before inserting. It compensates for failed inserts by deleting the copied image.
- The repository uses SQLite transactions for a toy and its categories, migrations enable foreign keys and WAL, and image deletion is guarded to the managed directory.
- There is no batch creation operation, no user-visible partial-failure report, and no immutable submission guard shared between the form and route. The route-level guard mitigates double taps but is not reusable/testable.
- Existing migrations and the toy schema can support batch intake without changes.

## Tests and compatibility

- Existing tests cover migrations, single toy service behavior, image selection, and child services; they do not cover multi-image selection options, permission/cancellation/error behavior, bulk persistence, duplicate submissions, or invalid route parameters.
- The app has `start`, `android`, `ios`, `web`, `lint`, and `test`, but no `dev` alias and no explicit typecheck script.
- `README.md` is still the Expo starter document and does not describe the real product, commands, local-data behavior, or platform limitations.

## Likely regressions to protect

- Preserve the existing single-photo create/edit flow and its managed-image cleanup.
- Do not allow multiple photos with editing/cropping enabled (SDK limitation).
- Keep web camera/picker calls user initiated and tolerate missing cancel callbacks.
- Copy all native images before creation and remove only files managed by PlayMap on failures.
- Keep the child experience independent of bulk intake and do not expose incomplete toys.
