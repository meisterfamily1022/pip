# PlayMap crawl implementation checklist

Created from a repository audit, Expo SDK 57 documentation review, baseline checks,
and a desktop/mobile crawl of every local app route on 2026-07-30.

## Baseline

- [x] Inventory routes, shared UI, persistence, models, tests, scripts, and platform branches.
- [x] Run TypeScript, ESLint, Jest, Expo Doctor, and web production export.
- [x] Crawl every Parent, Child, onboarding, and error route on localhost:8083.
- [x] Preserve the existing uncommitted redesign and build on its components.

## Navigation and mode safety

- [x] Standardize a reusable Parent Mode header with deterministic logical destinations.
- [x] Add visible Home/back controls and clear titles to all required Parent Mode child screens.
- [x] Route Add Room to a working form and guard repeated submissions.
- [x] Replace the grown-up return route label with the user-facing “Parent Mode” title.
- [x] Audit the rendered route tree for raw route names and technical identifiers.
- [x] Hide route-derived Child Mode headers and explicitly register every child screen.
- [x] Remove raw route names and duplicate back affordances.
- [x] Add safe in-app back/home navigation with logical fallbacks to every non-root page.
- [x] Enter Child Mode with replacement history so Back cannot bypass the parent PIN.
- [x] Guard direct links during startup/onboarding and keep Parent Mode behind the child lock.
- [x] Keep cleanup navigation explicit instead of relying on browser or native history.

## Forms, photos, and validation

- [x] Make a photo optional for manual toy creation and use an intentional “No photo yet” state.
- [x] Add visible camera/picker progress, cancellation, success, permission, and failure feedback.
- [x] Use native camera permission handling and provide an explicit web camera limitation/fallback.
- [x] Persist original photos in managed local storage without AI replacement.
- [x] Turn multiple selection into a persistent per-photo review queue.
- [x] Provide per-toy name, location, category, cleanup, adult-help, availability, replace, and remove controls.
- [x] Show selected/completed/incomplete/failed totals and keep invalid/failed records editable.
- [x] Add stable database intake keys so partial-save and restart retries cannot duplicate toys.
- [x] Recover Android picker results and persisted review drafts after restart.
- [x] Move PIN errors into the Parent Access form and preserve entered PIN values on failure.
- [x] Separate settings, PIN, and reset feedback so errors appear beside the relevant controls.
- [x] Restore Expo ImagePicker support on web and normalize picker failures/cancellation.
- [x] Preserve the existing photo when replacement selection is canceled.
- [x] Select the first room that actually has a storage spot.
- [x] Fix bulk preview, partial-failure retry, duplicate-submit, and validation behavior.
- [x] Add actionable no-location and invalid-location states.
- [x] Validate required names and toy fields before persistence while retaining service validation.
- [x] Recover pending Android picker results and handle unavailable/permanently denied cameras.
- [x] Keep web-selected images durable across app reloads.

## Visual and accessibility consistency

- [x] Centralize cream, surface, terracotta, pastel, status, spacing, radius, typography, and content-width tokens.
- [x] Use one safe-area-aware Parent Mode header treatment across home, library, toy, location, and settings routes.
- [x] Use one playful Child Mode header with a single deterministic back target on every subroute.
- [x] Replace native switches with the shared accessible pastel toggle for settings, single-toy, and batch-toy fields.
- [x] Standardize add/edit toy, room, storage spot, and settings forms with scroll-safe shells, shared cards, nearby validation, and inline actions.
- [x] Verify primary/pastel text contrast programmatically and cover buttons, toggles, headers, and field validation with component tests.
- [x] Add a real Toy Library filter sheet for category, room, storage spot, cleanup, adult help, child visibility, and archive status.
- [x] Show active filter count and labels, update results on Apply, and provide visible Reset actions.
- [x] Use high-contrast dark terracotta for every solid primary action.
- [x] Remove white text on pastel Child Mode actions and strengthen small-text contrast.
- [x] Replace literal boolean labels with “Yes” and “Not required.”
- [x] Standardize Parent/Child shells, headers, cards, fields, loading, and error states.
- [x] Make narrow headers/actions wrap without crowding.
- [x] Avoid empty icon columns and washed-out disabled controls.
- [x] Align splash and Android icon backgrounds with the warm cream palette.
- [x] Inspect Parent and Child routes at 390×844 portrait, 844×390 landscape, and 1440×900 web widths.

## Data safety and fixtures

- [x] Keep first launch and reset free of demo names, rooms, toys, and review data.
- [x] Reject one-character nickname remnants and return affected profiles to onboarding.
- [x] Prevent review-fixture helpers from running in production builds.
- [x] Route Add More Photos directly to the complete multi-record review workflow.
- [x] Show only v1 settings with working persistence; describe omitted future capabilities without fake controls.
- [x] Compute room, storage, and toy deletion impacts before presenting confirmation.
- [x] Block locations with dependent records and explain what must move or be deleted first.
- [x] Remove toy play history and all managed image variants during confirmed permanent deletion.
- [x] Verify cancel and confirm behavior for room, storage spot, toy, and full-data reset dialogs.
- [x] Remove the destructive Expo starter `reset-project` command.
- [x] Add a safe, confirmed in-app PlayMap data reset in foreign-key-safe order.
- [x] Delete the PIN and managed images during reset without blocking DB cleanup.
- [x] Add deterministic, idempotent crawl fixture support that preserves room/spot integrity.
- [x] Cover reset and fixture behavior with focused tests.

## Verification

- [x] Rerun focused tests after each logical group.
- [x] Rerun full typecheck, lint, Jest, Expo Doctor, and production export.
- [x] Re-crawl every route at desktop and phone widths and repair regressions.
- [x] Document device-only camera, permission, hardware-back, and secure-storage checks.

## Release QA rerun

- [x] Exercise empty, populated, invalid, successful, canceled, refreshed, and access-restricted web states.
- [x] Verify one-photo selection, missing-photo save, multi-photo selection, queue removal, restart recovery, partial save, retry, and duplicate protection.
- [x] Replace Toy Library archive/restore browser confirmation with the shared cross-platform confirmation dialog.
- [x] Verify destructive-dialog cancellation leaves toy, room, storage, and reset data unchanged.
- [x] Complete two consecutive full route passes with no new actionable web defects.
- [x] Confirm every required non-root route has exactly one working logical back control and no user-visible raw route label.
- [x] Inspect representative Parent, Child, settings, library, and bulk screens at 390×844, 844×390, and 1440×900.
- [x] Run TypeScript, ESLint, 131 Jest tests, Expo Doctor (20/20), Android/iOS/web production export, and `git diff --check`.
- [ ] Run the device checklist on an iOS simulator/device and Android emulator/device; Xcode `simctl` and Android `adb` are unavailable on this QA host.
