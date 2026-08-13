# Pip UI polish implementation map

## Baseline

- Branch: `codex/pip-ui-polish`, created from `origin/main` at `d6c8389`.
- Runtime: Expo 57.0.12, Expo Router 57.0.12, React Native 0.86.2, React 19.2.3.
- Validation: `npm test`, `npm run typecheck`, `npm run lint`, `npx expo-doctor`, and `npx expo export --platform ios`.
- Initial results: 56 Jest suites / 469 tests passed; TypeScript and Expo lint passed.
- Model routing: host does not expose primary-model switching; the active model is retained for every tier. No subagents are authorized by the prompt pack.

## Canonical data and services

- Child profile: `child_profiles`, read and written through `child-profiles-repository`; onboarding writes through `saveFirstChildProfile` and mirrors only compatibility defaults into `settings`.
- Toy name/photo/location IDs: `toys`, read and written through `toys-repository`; image selection is resolved by `toy-image-selection`.
- Room and storage spot names: `rooms` and `storage_spots`, through `rooms-repository`; child toy reads join these canonical rows.
- Active play and cleanup: `play_sessions`, through `play-sessions-repository` and `cleanup-service`.
- Onboarding/setup: required onboarding state is in `settings`; Parent Home derives its overview in `home-overview`.
- Child Mode completion: currently inferred by `hasEverPlayed` from any play session. This does not record entering Child Mode before choosing a toy and needs a canonical persisted signal.
- Entitlement: Supabase `get_my_entitlement` via `entitlement-service`; it has no place on child handoff cards.

## Targeted surfaces

- Entry: `src/app/index.tsx`, auth/landing copy under `src/features/landing`.
- Onboarding: child profile setup/preferences and shared onboarding/profile controls.
- Parent Home: `src/app/(parent)/parent/home.tsx` plus `src/features/parent/home-overview.ts`.
- Child journey: home, categories, toy suggestions, toy detail/retrieval, current toy, cleanup, and parent return.
- Shared primitives: `playmap-ui`, `child-ui`, `profile-ui`, `toy-ui`, and `playmap-theme`.

## Root-cause findings

- Lowercase child names are stored as entered and rendered raw on every surface. Presentation needs a non-mutating display helper that fixes all-lowercase input while preserving intentional mixed case.
- `Nex` is not a hardcoded string or a substring operation in the repository. Canonical toy names are stored whole; child cards constrain lines, and raw/partial stored values are rendered without validation or a shared fallback.
- `I · H` comes from direct `${roomName} · ${storageSpotName}` concatenation. No shared formatter trims, validates, or omits missing parts.
- `Look on the H in the I` comes from `LocationPanel` interpolating the same raw values into a sentence. It assumes both pieces are meaningful and never handles partial/missing location data.
- The five-toy target is incorrectly modeled as a required binary setup step, and setup copy claims the child cannot choose until every step is done.
- “Try Child Mode” is marked complete only after a play session exists, not when Child Mode is actually entered.
- Toy cards display `Free`, and Parent Home uses `catalogued` terminology.
- The categories screen keeps its bottom action inside an unbounded wrapping grid, so large text/small screens can make it unreachable or visually clipped despite the outer page shell.

## Implementation direction

1. Add shared, tested presentation helpers for child names, toy names, locations, and counts.
2. Apply briefing copy and hierarchy screen by screen.
3. Separate required setup from the recommended five-toy library milestone.
4. Persist Child Mode entry using the existing settings repository with an additive migration only if no existing durable field is suitable.
5. Standardize child toy imagery and bottom actions using existing primitives.
6. Finish with copy/state, accessibility/responsive, native simulator, and release-gate validation.
