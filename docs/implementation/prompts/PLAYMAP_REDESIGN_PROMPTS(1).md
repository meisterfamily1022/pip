# PlayMap — Redesign, Native Intake, and Quality Hardening Prompts

**Controller:** `PLAYMAP_PROMPT_LOOP_CONTROLLER.md`
**Execution:** sequential; change models at prompt boundaries according to the table below

**Document status:** Active controlled build-loop plan
**Prompt count:** 10 prompts, numbered 0–9
**Companion brief:** `PLAYMAP_REDESIGN_IMPLEMENTATION_BRIEF.md`
**Loop controller:** `PLAYMAP_PROMPT_LOOP_CONTROLLER.md`
**Execution rule:** Complete, review, test, and verify each prompt before moving to the next. Do not combine prompts.

## 1. Required Reading

Before editing, read:

1. `PLAYMAP_PROMPT_LOOP_CONTROLLER.md`;
2. `PLAYMAP_REDESIGN_IMPLEMENTATION_BRIEF.md`;
3. this file;
4. `README.md`, `docs/V1-SCOPE.md`, and relevant current audit/checklist documents;
5. the actual current branch and dirty state.

The agent must not assume that a linked worktree and the main checkout have the same files. Determine the active checkout and report it.

## 2. Execution Rules

### Model assignment

Use the assigned model in Codex for each prompt. If unavailable, use the
controller's fallback and report it; do not silently substitute.

| Prompt | Assigned model | Primary focus |
| --- | --- | --- |
| 0 | Sol | baseline, branch, architecture, risk inventory |
| 1 | Sol | testability, startup, route/runtime reliability |
| 2 | Terra | Parent Mode navigation and product crawl |
| 3 | Sol | camera/photo intake and platform behavior |
| 4 | Sol | bulk intake queue, drafts, persistence, canonical save |
| 5 | Sol | multi-child concurrent checkout and session integrity |
| 6 | Terra | screen-by-screen professional design acceptance |
| 7 | Terra | visual, interaction, accessibility, and responsive polish |
| 8 | Sol | destructive actions, settings, reset, data safety |
| 9 | Sol | final QA, regression, evidence, and handoff |

For every prompt:

1. Restate the active scope in 3–6 bullets.
2. Inspect the exact files likely to change.
3. Check branch and dirty state.
4. Preserve unrelated user changes.
5. Implement only the active prompt.
6. Add regression coverage for changed behavior.
7. Run targeted tests and relevant static checks.
8. Perform a visual or runtime check whenever the prompt changes UI or startup behavior.
9. Run two consecutive passes when the prompt is a final or high-risk verification prompt.
10. Record files, behavior, tests, checks, limitations, and remaining risks.
11. Continue automatically only when no hard stop is reached.

Do not claim native camera, native photo-library, simulator, or device verification unless it actually occurred.

## 3. Hard Stops

Stop for human review if:

- implementation requires discarding or resetting user changes;
- a migration would destroy or silently rewrite existing data;
- the canonical toy repository/service is unclear;
- a new product decision is required that this brief does not answer;
- native verification is being represented as complete without an available device/simulator;
- a dependency or platform change would materially alter the app architecture;
- tests remain failing for an unresolved reason after diagnosis;
- the agent would need credentials, production access, or paid AI calls.

---

# PROMPT 0 — Baseline, Checkout, and Risk Inventory

```text
Model: Sol
Strength: Extra High

PlayMap

Read `PLAYMAP_PROMPT_LOOP_CONTROLLER.md`, `PLAYMAP_REDESIGN_IMPLEMENTATION_BRIEF.md`, and `PLAYMAP_REDESIGN_PROMPTS.md` before editing.

This is an inspection and baseline prompt. Do not make broad product changes yet.

1. Identify the active repository root, branch, linked worktrees, package manager, Expo SDK, router entry, and current dirty state.
2. Determine whether the current checkout contains the redesign and the newer toy photo/bulk-intake work. Do not assume the main checkout and any Claude/Codex worktree are synchronized.
3. Read the current package.json, app.json, database/migration files, toy service/repository, image-storage code, navigation/access code, Jest configuration, and existing quality/audit documents.
4. Run the safest baseline checks available:
   - npm test
   - npx tsc --noEmit
   - npx expo lint
   - npx expo-doctor
   - git diff --check
5. If a check fails, classify it as production logic, test-environment/module resolution, platform-only, or pre-existing/unrelated. Do not “fix” failures by deleting tests or broad dependency churn.
6. Produce a concrete risk inventory covering:
   - native camera/photo-library verification;
   - bulk intake completeness;
   - Parent Mode navigation;
   - persistence and image cleanup;
   - child-mode recommendation/cleanup invariants;
   - concurrent multi-child checkout/session integrity;
   - visual and accessibility risks;
   - startup and route-access risks.

Do not modify code unless a minimal non-functional test/setup correction is required to make the baseline diagnosable. If you make one, explain it and test it.

Return the exact checkout, branch, dirty-state summary, baseline results, and the ordered risk inventory. Continue to Prompt 1 only if the repository and scope are understood.
```

## Prompt 0 Gate

The agent must know which checkout is authoritative and must not overwrite or reset the dirty worktree.

---

# PROMPT 1 — Repair Testability and Startup/Route Reliability

```text
Model: Sol
Strength: High

Implement only testability and startup/route reliability for PlayMap.

Inspect first. Likely areas include package.json, Jest config/setup, app entry/layout files, startup/route-access files, and native-module mocks.

Required behavior:

1. Make all relevant existing .ts and .tsx tests discoverable without weakening assertions.
2. Mock or isolate native-only modules only at the test boundary. Do not replace production camera, FileSystem, SQLite, or photo behavior with mocks.
3. Ensure Expo Router starts from the actual project checkout with the canonical main entry and does not resolve an accidental relative worktree path.
4. Audit startup, onboarding completion, Parent Mode, and Child Mode route guards for stale state, infinite loading, missing fallback, or inaccessible routes.
5. Preserve the existing first-launch onboarding contract and existing persisted settings.
6. Add regression tests for any startup or route-access bug found.

Do not redesign screens in this prompt. Do not upgrade dependencies unless required to fix a proven test/startup issue and the Expo-compatible version is confirmed by the repository.

Verification:
- focused Jest suites first;
- npm test;
- npx tsc --noEmit;
- npx expo lint;
- npx expo-doctor;
- git diff --check.

Stop if fixing startup requires a database reset or if the canonical route state is ambiguous.
```

---

# PROMPT 2 — Parent Mode Navigation and Full Product Crawl

```text
Model: Terra
Strength: High

Audit and repair Parent Mode navigation end to end.

Crawl every reachable Parent Mode route, including Home, Toy Library, Add Toy, Edit Toy, Locations, Add/Edit Location, Settings, Child Mode entry, PIN return, and not-found/fallback routes.

Required checks:

1. Every visible control either performs its stated action or is removed/disabled with an honest explanation.
2. Every screen has an appropriate back/home/close path and no route traps the user.
3. Back behavior is consistent with stack history and does not create duplicate headers or accidental exits.
4. Empty states, loading states, validation errors, and save failures are actionable.
5. Location and toy creation/editing preserve selected values and return to the correct parent screen after success.
6. Parent-gated returns require the existing PIN flow and do not expose parent routes through a child-only path.
7. Add regression tests for navigation guards and any dead control repaired.

Use the existing design system. Keep visual polish limited to issues discovered during this crawl; do not begin the broad visual pass yet.

Verify with tests, TypeScript, lint, Expo Doctor, and a web route crawl if available. Capture a route-by-route result table in the final report.
```

---

# PROMPT 3 — Complete Single-Toy Camera and Photo Intake

```text
Model: Sol
Strength: Extra High

Harden the single-toy media intake flow. Do not implement bulk review in this prompt.

Required scenarios:

- save a toy without a photo;
- take one photo with camera;
- allow camera permission;
- deny camera permission;
- select one photo from the library;
- cancel camera/library selection;
- reject or safely handle unsupported/oversized media;
- remove and replace a selected photo;
- save failure without losing the form draft;
- persisted image appears in Toy Library, Toy Detail, and Child Mode where applicable;
- image survives app restart/reload on the supported platform;
- deleting a toy removes or safely retires its stored image without deleting another toy’s image.

Use the platform-appropriate production storage path. Keep web data-URL behavior separate from native FileSystem behavior. Do not hide permission or storage errors.

Add focused service, storage, and component regression tests. Mock native modules only in tests.

If a real iOS/Android device or simulator is available, run the complete native matrix and record the platform. If not available, run web verification and explicitly leave native verification open.

Run two consecutive verification passes before completing this prompt.
```

---

# PROMPT 4 — Bulk Photo Intake, Review, and Canonical Save

```text
Model: Sol
Strength: Extra High

Implement or complete the production bulk toy-intake workflow using the existing draft/queue/media abstractions where they are sound.

The parent must be able to:

1. choose multiple photos from the library, and use camera capture repeatedly where the platform supports it;
2. see a review queue with one draft per intended toy/photo item;
3. edit each draft’s name, room, storage spot, category/categories, and photo;
4. remove one draft without losing the others;
5. identify incomplete or invalid drafts inline;
6. save valid drafts while retaining failed drafts for correction/retry;
7. prevent duplicate accidental submissions while a save is in progress;
8. see honest per-item success/failure results;
9. preserve canonical toy-service/repository rules and hidden/archived defaults;
10. recover the queue safely if the app is interrupted, according to the existing architecture.

Do not create a second toy persistence model. Do not silently invent toy names from filenames unless the current product decision explicitly supports that; if filenames are used as initial drafts, make them editable and preserve a clear fallback.

Handle:
- zero selected files;
- cancellation;
- duplicate files;
- unsupported media;
- partial save failure;
- storage failure;
- missing required fields;
- empty category/location data;
- very large selections without freezing the UI.

Add tests for queue operations, validation, partial success, retry, idempotent save protection, and media cleanup. Verify on web and native where available.

Do not move to Prompt 5 until the complete review/save journey is usable from the actual Parent Mode UI.
```

---

# PROMPT 5 — Multi-Child Checkout and Concurrent Session Integrity

```text
Model: Terra
Strength: Extra High

Implement and verify the complete multi-child checkout experience. Inspect child profiles/configuration, play-session schema, repositories/services, Child Mode routes, parent-return flow, and session recovery before editing.

Required behavior:

1. Each configured child has an independent active checkout and cleanup state.
2. Child A can check out Toy A while Child B checks out Toy B; neither session replaces, blocks, or completes the other.
3. A toy cannot be checked out by two children at once unless existing product rules explicitly support shared play. Show an actionable conflict message.
4. Child Mode is scoped to the active child and never displays another child’s toy, cleanup prompt, or history.
5. Parent Mode includes a consolidated active-checkout view grouped by child, with a safe way to inspect or resolve a session.
6. Cleanup completion updates only the correct child/session and unlocks only that child’s next choice.
7. App restart, route changes, child switching, and parent PIN return recover every active session deterministically.
8. Deleting, hiding, archiving, or moving a checked-out toy does not silently corrupt a session.
9. If needed, make the smallest additive migration with foreign keys/indexes and legacy-data tests. Never reset existing data.
10. Do not hard-code two children; support the configured child set.

Add regression coverage for concurrent checkout, duplicate-toy conflict, isolated cleanup, restart/recovery, child scoping, parent overview, and destructive changes during an active session. Verify the actual UI, then run focused tests, npm test, tsc, lint, Expo Doctor, and git diff --check.
```

# PROMPT 6 — Screen-by-Screen Professional Design Acceptance

```text
Model: Terra
Strength: Extra High

Perform a formal screen-by-screen design acceptance pass so PlayMap looks intentionally designed, cohesive, and professionally shipped—not merely functional.

Create a complete route/screen inventory covering onboarding, Parent Mode, bulk review, Locations, Settings, Child Mode, parent return, fallback/error routes, and modal/permission/confirmation states. Inspect phone, tablet, and web layouts where supported.

Repair within the existing pastel PlayMap direction:
- hierarchy, spacing, typography, color, contrast, radii, icons, illustrations, and shared component usage;
- polished empty, loading, success, error, disabled, permission-denied, and retry states;
- safe areas, status/navigation bars, keyboard behavior, focus order, Dynamic Type, VoiceOver labels, touch targets, reduced motion, and screen-reader clarity;
- photo thumbnails, bulk progress, per-item status, partial-save feedback, and active-checkout indicators;
- no placeholder-looking UI, raw route names, dead controls, duplicate headers, generic icons, clipped text, horizontal overflow, or misleading affordances.

Use tokens/primitives and regression tests. Capture screenshots or equivalent visual evidence for every route, inspect console warnings, then repeat the review after fixes. Produce an acceptance table with screen, states checked, issues, fixes, and remaining limitations. Do not claim native visual acceptance unless a native simulator/device was actually used.
```

# PROMPT 7 — Visual, Interaction, and Accessibility Quality Pass

```text
Model: Sol
Strength: High

Conduct a systematic visual and interaction audit across the current PlayMap screens, then implement only fixes supported by the existing product direction.

Inspect:
- onboarding;
- Parent Home;
- Toy Library and filters;
- Add/Edit Toy and bulk review;
- Locations;
- Settings;
- Child Home, categories, suggestions, toy detail, current toy, cleanup, and parent return.

Look for:
- inconsistent spacing, radius, typography, colors, or icon treatment;
- low contrast or washed-out primary actions;
- tiny hit targets;
- clipped text, keyboard overlap, safe-area errors, and horizontal overflow;
- duplicate headers/back buttons;
- generic or misleading icons;
- controls that look interactive but are not;
- excessive visual demand for child screens;
- web-only invalid DOM/SVG/style warnings;
- legacy shadow warnings introduced by the changed code.

Use shared tokens/primitives rather than one-off values. Preserve the pastel direction. Do not introduce a new visual language or dark dashboard aesthetic.

Add regression tests for behaviorally important fixes. Perform a web screenshot/crawl and native inspection if available. Report any native-only uncertainty.
```

---

# PROMPT 8 — Destructive Actions, Settings, and Data Safety

```text
Model: Sol
Strength: High

Audit and harden destructive actions and settings without expanding Settings into unrelated features.

Cover:
- deleting a toy;
- removing photos;
- deleting a room or storage spot with dependent toys;
- hide/archive behavior;
- reset/cleanup flow;
- PIN change and parent authentication;
- interrupted saves and retry behavior;
- app restart during a pending or incomplete intake.

Required behavior:

1. Destructive actions use explicit, specific confirmation copy.
2. Dependency conflicts are explained and handled according to existing product rules; never silently orphan records.
3. Reset is clearly distinguished from ordinary cleanup and cannot be triggered accidentally.
4. PIN changes preserve or invalidate sessions according to the existing security contract.
5. Failed deletion or reset leaves data recoverable and reports the failure.
6. Add tests for confirmation gating, dependency handling, reset safety, and image cleanup.

Do not add cloud backup, export, accounts, or new settings categories in this prompt.
```

---

# PROMPT 9 — Final Autonomous QA Loop and Handoff

```text
Model: Sol
Strength: Extra High

Perform the final two-pass PlayMap QA loop across the entire scope of PLAYMAP_REDESIGN_IMPLEMENTATION_BRIEF.md.

Pass A:
1. Run the complete automated suite and static checks.
2. Crawl onboarding and every Parent Mode route.
3. Test Add Toy without media.
4. Test camera and library flows on every available platform.
5. Test bulk intake, review, partial failure, retry, and persistence.
6. Test two or more children checking out different toys simultaneously, child scoping, duplicate-toy conflict, isolated cleanup, restart recovery, and the parent active-checkout overview.
7. Test Child Mode selection, current toy, cleanup, and parent return.
8. Test delete/archive/hide/reset safeguards, including checked-out toys.
9. Inspect console output for new warnings/errors.
10. Inspect every route and state for overflow, contrast, safe area, keyboard, accessibility, dead controls, performance, and visual inconsistency.

Fix every issue found that is within scope. For each fix, add a regression test where practical and rerun the relevant checks.

Pass B:
Repeat the complete verification from a fresh app process without relying on stale cache or a previous happy-path state. Do not call the result clean until Pass B matches Pass A.

Required final checks:
- npm test
- npx tsc --noEmit
- npx expo lint
- npx expo-doctor
- git diff --check

Final report must include:
- exact checkout and branch;
- files changed;
- features completed;
- automated test results;
- multi-child checkout scenarios and data-migration results;
- screen-by-screen design acceptance evidence and unresolved visual/native limitations;
- web verification results;
- native device/simulator verification with exact platform, or explicit statement that it was unavailable;
- known pre-existing warnings;
- unresolved risks;
- manual steps Sarah must perform next;
- whether the work is ready for commit.

Never report native camera/photo verification as complete if it was not actually run.
```

## 4. Final Handoff Standard

The agent must not merely say “implemented.” It must report evidence. Any failed check, unavailable device, unresolved warning, or intentionally deferred item must be named explicitly.
