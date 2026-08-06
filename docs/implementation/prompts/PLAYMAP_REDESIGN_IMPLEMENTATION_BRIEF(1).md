# PlayMap — Redesign, Native Intake, and Quality Hardening Brief

**Execution controller:** `PLAYMAP_PROMPT_LOOP_CONTROLLER.md`
**Model policy:** switch models at prompt boundaries; use Sol for architecture,
data, native/runtime, concurrency, and final QA; use Terra for UI, visual,
accessibility, and interaction work. Record fallbacks explicitly.

**Document status:** Canonical implementation brief  
**Prepared:** August 5, 2026  
**Product:** PlayMap mobile toy-library app  
**Repository:** Expo React Native project; the agent must determine the active checkout from the human’s starting directory  
**Current working branch:** `feature/ai-assisted-toy-entry` unless the repository reports otherwise  
**Implementation mode:** Controlled autonomous build loop  
**Schema mode:** `ADDITIVE_ALLOWED` — local SQLite changes are allowed when required, but must be additive, migrated safely, and tested  

## 1. Purpose

PlayMap is a low-demand toy-library app for children who become overwhelmed by too many choices. Parents inventory toys with photos and locations. Children receive a small number of appropriate choices, play with one toy, and confirm cleanup before choosing another.

The immediate objective is to turn the current redesign and toy-intake work into a dependable, attractive, device-usable V1. The priority is the core loop:

```text
Parent opens PlayMap
→ adds or imports toys quickly
→ assigns each toy to a room, storage spot, and category
→ optionally captures or selects photos
→ one or more children receive small choice sets
→ each child checks out a toy independently
→ children may play simultaneously
→ each child confirms cleanup before that child chooses again
```

This is a product-quality and implementation-hardening effort, not permission to invent unrelated features.

## 2. Current State

The current redesign work has already included:

- a pastel, child-friendly design direction: cream background, blush peach, pale sage, muted mint, soft yellow, lavender accents, rounded cards, gentle illustrations, and low-demand screens;
- an Expo Router application with Parent Mode, Child Mode, onboarding, locations, settings, toy library, toy detail, cleanup, and toy add/edit flows;
- a local SQLite-backed domain for rooms, storage spots, toys, categories, toy/category relationships, play sessions, and settings;
- design tokens, icons, and shared UI primitives under `src/design/`;
- camera and photo-library controls in Add Toy;
- web photo persistence through data URLs because the Expo SDK 57 web FileSystem shim does not support the native `File`/`Directory` API;
- native FileSystem handling preserved for native platforms;
- field-level Add Toy validation for name, room, storage spot, and category;
- optional photos;
- bulk-intake draft/queue-related code already present or partially present in the current worktree;
- multi-child checkout support is now required: children need independent active checkouts and cleanup state at the same time;
- previous web verification showing photo-less save, photo persistence across reload, correct SVG transform syntax, and no new `validatePath` or invalid-DOM errors;
- clean checks reported at different points, including TypeScript, Expo lint, Expo Doctor, and tests.

The current worktree may be dirty. Existing changes belong to the user. The agent must inspect and preserve them, never reset or discard them automatically.

Known unresolved or insufficiently verified areas:

- iOS/Android camera and photo-library behavior has not been proven on a real device or simulator;
- Expo Go has produced development-build mismatch, tunnel timeout, and loading issues; a local development build may be required;
- bulk photo intake needs a complete, understandable review/save flow rather than merely file-selection code;
- Parent Mode navigation and back behavior require a full crawl;
- visual consistency, spacing, contrast, button states, and custom controls need systematic review;
- destructive actions, reset behavior, and settings scope need confirmation;
- the existing Jest configuration and native-module mocks may need hardening so all relevant tests execute rather than merely compile.

## 3. Product Rules

### 3.1 Child experience

- Keep the number of choices intentionally small. Default to three when the product already supports configurable 1/3/5 choices.
- Avoid dense dashboards, excessive text, tiny hit targets, and unnecessary animation.
- Use clear visual hierarchy and predictable actions.
- Never allow a child to become trapped without a visible, understandable path back to the appropriate parent-gated surface.
- Cleanup is a real state transition, not decorative copy. A completed play session must not be silently bypassed by navigation or app restart unless the existing product rules explicitly allow recovery.

### 3.2 Parent experience

- Parents need fast intake, clear location/category assignment, search, filters, edit, hide/archive, and safe deletion.
- Photos are helpful but not mandatory.
- Bulk intake must make uncertainty visible. A parent must be able to review, correct, remove, and save drafts before records become canonical toys.
- Parents must be able to see which child currently has which toy checked out, identify incomplete cleanup, and resolve one child’s session without affecting another child’s session.
- Camera capture and photo-library selection must handle permission denial, cancellation, empty selection, unsupported files, duplicate selection, and storage failure without losing unrelated form data.
- All saved toy records must use the canonical repository/service path.

### 3.3 Multi-child checkout rules

- Each configured child has an independent active checkout/play session.
- A toy may not be checked out by two children simultaneously unless existing product rules explicitly support shared play; default behavior is an actionable conflict.
- Cleanup belongs to the child/session that checked out the toy. Completing one cleanup never changes another child’s session.
- App restart, navigation, child switching, and parent return recover all active sessions deterministically.
- Child Mode shows only the current child’s active toy and state. Parent Mode may show a consolidated view grouped by child.
- If a checked-out toy is hidden, archived, deleted, or moved, preserve session integrity and provide a safe recovery path.
- Additive schema changes are allowed only when required to represent child identity and concurrent sessions; use safe migrations, foreign keys, indexes, and legacy-data tests.
- Do not hard-code a two-child limit.

### 3.4 Data integrity

- Do not create a second toy source of truth for bulk intake.
- Drafts/queues may be temporary or persisted only where the existing architecture requires recovery, but final records must go through the canonical toy service/repository.
- Hidden and archived toys must remain excluded from child recommendations according to existing rules.
- Do not delete image files without confirming the target toy and handling storage failures safely.
- Preserve existing data during migrations. Never reset the database as part of normal implementation or verification.

## 4. Canonical Architecture

The agent must locate and reuse the actual current paths, but the intended responsibilities are:

- `src/domain/models.ts`: domain contracts and types;
- `src/database/`: SQLite schema, migrations, rows, and database foundation;
- `src/repositories/toys-repository.ts`: canonical toy persistence;
- `src/features/toys/toy-service.ts`: toy validation and business rules;
- `src/features/toys/toy-image-storage.ts` and/or the current photo service: platform-specific image persistence;
- `src/features/toys/toy-batch-drafts.ts`, `toy-intake-queue.ts`, and `toy-media-intake.ts`: reuse or repair existing bulk-intake abstractions rather than duplicating them;
- `src/features/navigation/` and `src/startup/route-access.ts`: canonical navigation/access behavior where already established;
- `src/theme/` and `src/design/`: canonical visual tokens and shared primitives.

The agent must confirm these paths before editing. If the actual repository differs, use the current canonical equivalent and report it.

## 5. Authority Hierarchy

When sources disagree, use this order:

1. this brief;
2. the active prompt in `PLAYMAP_REDESIGN_PROMPTS.md`;
3. current repository behavior and tests;
4. existing V1 scope/product docs;
5. screenshots or prior conversation context.

Screenshots and earlier descriptions are visual/product context, not proof that a behavior exists.

## 6. Non-Goals for This Prompt Set

Do not expand into:

- cloud sync, accounts, payments, subscriptions, or social sharing;
- AI toy recognition or paid AI calls;
- a new backend or remote image service;
- analytics or telemetry unrelated to local reliability;
- a complete redesign of the product concept;
- broad dependency upgrades unrelated to a failing check;
- native App Store release work;
- deleting the existing redesign or rebuilding from a blank project;
- schema reset, destructive migration, or data loss.

## 7. Definition of Done

PlayMap is ready for this phase when:

- the app launches from the intended checkout and route access is deterministic;
- Parent Mode has no dead ends or trapped screens;
- Add Toy works without photos and with camera/library photos;
- bulk intake supports selection, review, correction, removal, retry, and canonical save;
- saved images persist and are cleaned up safely on deletion;
- child recommendations exclude invalid/hidden/archived records and preserve cleanup behavior;
- multiple children can check out simultaneously with isolated active-session and cleanup state;
- duplicate checkout conflicts are prevented or handled according to explicit product rules;
- every screen has polished loading, empty, error, success, disabled, permission-denied, and confirmation states where relevant;
- visual review covers every route at phone, tablet, and web widths, with accessibility and performance checks;
- affected tests, TypeScript, lint, Expo Doctor, and `git diff --check` pass;
- the app has been visually inspected on web and, where available, a native simulator/device;
- native limitations are explicitly reported rather than claimed as verified;
- two consecutive final verification passes produce the same clean result.
